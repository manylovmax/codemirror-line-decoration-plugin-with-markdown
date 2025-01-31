import { EditorState } from '@codemirror/state'
import { keymap, EditorView, drawSelection, highlightActiveLine, MatchDecorator, WidgetType, Decoration, ViewPlugin } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data';
import { Table } from '@lezer/markdown';

import richEditor from './codemirror-rich-markdoc/src';
import config from './codemirror-rich-markdoc/example/markdoc';
// import './style.css';

// @ts-expect-error
// import doc from './codemirror-rich-markdoc/example/example.md?raw';

const TEXT_SEPARATORS = {
  user: '__1',
  assistant: '__2',
}

class lineAnswerWidget extends WidgetType {
  toDOM() {
    let wrap = document.createElement("span");
    wrap.className = "cm-line-decorator";
    let child = document.createElement("span");
    child.className = "cm-line-decorator__icon-wrapper";
    child.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-bot"><path d="M12 8V4H8"></path><rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>';
    wrap.appendChild(child);
    child = document.createElement("span");
    child.className = "cm-line-decorator__split-line";
    wrap.appendChild(child);
    return wrap;
  }

  ignoreEvent() { return false }
};

class lineTaskWidget extends WidgetType {
  toDOM() {
    let wrap = document.createElement("span");
    wrap.className = "cm-line-decorator";
    let child = document.createElement("span");
    child.className = "cm-line-decorator__icon-wrapper";
    child.innerHTML = '<svg width="16px" height="16px"  viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-linecap="round" stroke-width="2"><path d="M4 21V18.5C4 15.4624 6.46243 13 9.5 13H14.5C17.5376 13 20 15.4624 20 18.5V21M8 21V18M16 21V18M16 6.5C16 8.70914 14.2091 10.5 12 10.5C9.79086 10.5 8 8.70914 8 6.5C8 4.29086 9.79086 2.5 12 2.5C14.2091 2.5 16 4.29086 16 6.5Z"/></svg>';
    wrap.appendChild(child);
    child = document.createElement("span");
    child.className = "cm-line-decorator__split-line";
    wrap.appendChild(child);
    return wrap;
  }

  ignoreEvent() { return false }
};
class lineEndWidget extends WidgetType {
  toDOM() {
    let wrap = document.createElement("span");
    wrap.className = "cm-line-decorator";
    let child = document.createElement("span");
    child.className = "cm-line-decorator__split-line-end";
    wrap.appendChild(child);
    return wrap;
  }

  ignoreEvent() { return false }
};

const lineTaskMatcher = new MatchDecorator({
  regexp: /__1/g,
  decoration: match => Decoration.replace({
    widget: new lineTaskWidget(match[1]),
  })
});

const lineAnswerMatcher = new MatchDecorator({
  regexp: /__2/g,
  decoration: match => Decoration.replace({
    widget: new lineAnswerWidget(match[1]),
  })
});
const lineEndMatcher = new MatchDecorator({
  regexp: /___/g,
  decoration: match => Decoration.replace({
    widget: new lineEndWidget(match[1]),
  })
});

const lineTaskDecoratorPlugin = ViewPlugin.fromClass(class {
    lines
    constructor(view) {
      this.lines = lineTaskMatcher.createDeco(view)
    }
    update(update) {
      this.lines = lineTaskMatcher.updateDeco(update, this.lines)
    }
  }, {
    decorations: instance => instance.lines,
    provide: plugin => EditorView.atomicRanges.of(view => {
      return view.plugin(plugin)?.lines || Decoration.none
    })
});

const lineAnswerDecoratorPlugin = ViewPlugin.fromClass(class {
    lines
    constructor(view) {
      this.lines = lineAnswerMatcher.createDeco(view)
    }
    update(update) {
      this.lines = lineAnswerMatcher.updateDeco(update, this.lines)
    }
  }, {
    decorations: instance => instance.lines,
    provide: plugin => EditorView.atomicRanges.of(view => {
      return view.plugin(plugin)?.lines || Decoration.none
    })
});

const lineEndDecoratorPlugin = ViewPlugin.fromClass(class {
    lines
    constructor(view) {
      this.lines = lineEndMatcher.createDeco(view)
    }
    update(update) {
      this.lines = lineEndMatcher.updateDeco(update, this.lines)
    }
  }, {
    decorations: instance => instance.lines,
    provide: plugin => EditorView.atomicRanges.of(view => {
      return view.plugin(plugin)?.lines || Decoration.none
    })
});

export function getFormattedText(textToParse: string) {
  // добавление тега user
  let resultTextSplit: string[] = [];
  let textToParseSplit: string[] = textToParse.split('\n');
  if (textToParseSplit[0] != TEXT_SEPARATORS.user && textToParseSplit[0] != TEXT_SEPARATORS.assistant) {
    resultTextSplit.push(TEXT_SEPARATORS.user);// tag user
  }
  resultTextSplit = resultTextSplit.concat(textToParseSplit);
  // уборка дублирующих тегов (слитие нескольких смежных сообщений одного типа в одно)
  textToParseSplit = resultTextSplit;
  let currentTag: string = '';
  resultTextSplit = [];
  for (let i = 0; i < textToParseSplit.length; i++) {
      if (textToParseSplit[i] == TEXT_SEPARATORS.user) {
          if (currentTag == TEXT_SEPARATORS.user) {
              continue;
          }
          currentTag = textToParseSplit[i];
      }
      if (textToParseSplit[i] == TEXT_SEPARATORS.assistant) {
          if (currentTag == TEXT_SEPARATORS.assistant) {
              continue;
          }
          currentTag = textToParseSplit[i];
      }
      resultTextSplit.push(textToParseSplit[i]);
  }

  return resultTextSplit.join('\n');
}

const onNewLineInput = EditorView.updateListener.of(function(viewUpdate) {
  if (viewUpdate.docChanged) {
      // console.log(viewUpdate);
      if (viewUpdate.changes.inserted.length == 2) {
        if (
          viewUpdate.changes.inserted[1].lines == 2 && 
          viewUpdate.changes.inserted[1].text[0] == '' &&
          viewUpdate.changes.inserted[1].text[1] == ''
        ) {
          // console.log("Enter key has been hit");
          const currentLine = viewUpdate.state.doc.lineAt(viewUpdate.state.selection.main.from).number - 1;
          // console.log("currentLine", currentLine);
          let editorValueSplit = viewUpdate.state.doc.text;
          let sectionMarker = '';
          for (let i = currentLine - 1; i >= 0; i--) {
            if (sectionMarker == '' && (editorValueSplit[i] == TEXT_SEPARATORS.user || editorValueSplit[i] == TEXT_SEPARATORS.assistant)){
              sectionMarker = editorValueSplit[i];
              break;
            }
          }
          let emptyLinesCounter = 0;
          if (sectionMarker == TEXT_SEPARATORS.assistant) {
            for (let i = currentLine - 1; i >= 0; i--) {
              if (editorValueSplit[i].trim() == ''){
                emptyLinesCounter++;
              } else {
                break;
              }
            }
            if (emptyLinesCounter >= 2) {
              let lineInfo = viewUpdate.state.doc.line(currentLine);
              let changes = [{from: lineInfo.from, insert: TEXT_SEPARATORS.user}];
              editorValueSplit = viewUpdate.state.doc.text;
              for (let i = currentLine; i< editorValueSplit.length; i++) {
                if (editorValueSplit[i] == TEXT_SEPARATORS.user) {
                  lineInfo = viewUpdate.state.doc.line(i+1);
                  changes.push({from: lineInfo.from, to: lineInfo.to, insert: ''});
                  break;
                }
                if (editorValueSplit[i] == TEXT_SEPARATORS.assistant)
                  break;
              }
              viewUpdate.view.dispatch({changes});
            }
          }
        }
      }
  } 
});

export function setupEditor(selector, initialText) {
  const state = EditorState.create({
    doc: initialText,
    extensions: [
      richEditor({
        markdoc: config,
        lezer: {
          // codeLanguages: languages,
          extensions: [Table]
        }
      }),
      EditorView.lineWrapping,
      history(),
      drawSelection(),
      highlightActiveLine(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      lineTaskDecoratorPlugin, 
      lineAnswerDecoratorPlugin, 
      lineEndDecoratorPlugin,
      onNewLineInput
    ],
  });

  const parent = document.querySelector(selector) as Element;
  const view = new EditorView({ state, parent });
  return view;
}

export function getEditorValue(editorView) {
  return editorView.state.doc.toString();
}

export function setEditorValue(editorView, newValue) {
  let transaction = editorView.state.update({changes: {from: 0, to: editorView.state.doc.length, insert: newValue}});
  editorView.dispatch(transaction);
}

export function getEditorSelection(editorView) {
  return editorView.state.sliceDoc(editorView.state.selection.main.from, editorView.state.selection.main.to);
}

export function getEditorCursorPosition(editorView) {
  return editorView.state.selection.main.head;
}