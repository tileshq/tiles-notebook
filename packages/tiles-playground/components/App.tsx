'use client';

import {$createLinkNode} from '@lexical/link';
import {$createListItemNode, $createListNode} from '@lexical/list';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {$createHeadingNode, $createQuoteNode} from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isTextNode,
  DOMConversionMap,
  TextNode,
} from 'lexical';

import {isDevPlayground} from '@/utils/appSettings';
import {useSettings} from '@/context/SettingsContext';
import {SharedHistoryContext} from '@/context/SharedHistoryContext';
import {TableContext} from '@/plugins/TablePlugin';
import {ToolbarContext} from '@/context/ToolbarContext';
import DocumentHead from '@/components/DocumentHead';
import Editor from '@/components/Editor';
import PlaygroundNodes from '@/nodes/PlaygroundNodes';
import { $prepopulatedRichText } from '@/utils/initialContent';
//import DocsPlugin from '@/plugins/DocsPlugin';
//import PasteLogPlugin from '@/plugins/PasteLogPlugin';
//import TestRecorderPlugin from '@/plugins/TestRecorderPlugin';
import {parseAllowedFontSize} from '@/plugins/ToolbarPlugin/fontSize';
import TypingPerfPlugin from '@/plugins/TypingPerfPlugin';
import Settings from '@/components/Settings';
import PlaygroundEditorTheme from '@/themes/PlaygroundEditorTheme';
import {parseAllowedColor} from '@/ui/ColorPicker';
import Image from 'next/image';

function getExtraStyles(element: HTMLElement): string {
  // Parse styles from pasted input, but only if they match exactly the
  // sort of styles that would be produced by exportDOM
  let extraStyles = '';
  const fontSize = parseAllowedFontSize(element.style.fontSize);
  const backgroundColor = parseAllowedColor(element.style.backgroundColor);
  const color = parseAllowedColor(element.style.color);
  if (fontSize !== '' && fontSize !== '15px') {
    extraStyles += `font-size: ${fontSize};`;
  }
  if (backgroundColor !== '' && backgroundColor !== 'rgb(255, 255, 255)') {
    extraStyles += `background-color: ${backgroundColor};`;
  }
  if (color !== '' && color !== 'rgb(0, 0, 0)') {
    extraStyles += `color: ${color};`;
  }
  return extraStyles;
}

function buildImportMap(): DOMConversionMap {
  const importMap: DOMConversionMap = {};

  // Wrap all TextNode importers with a function that also imports
  // the custom styles implemented by the playground
  for (const [tag, fn] of Object.entries(TextNode.importDOM() || {})) {
    importMap[tag] = (importNode) => {
      const importer = fn(importNode);
      if (!importer) {
        return null;
      }
      return {
        ...importer,
        conversion: (element) => {
          const output = importer.conversion(element);
          if (
            output === null ||
            output.forChild === undefined ||
            output.after !== undefined ||
            output.node !== null
          ) {
            return output;
          }
          const extraStyles = getExtraStyles(element);
          if (extraStyles) {
            const {forChild} = output;
            return {
              ...output,
              forChild: (child, parent) => {
                const textNode = forChild(child, parent);
                if ($isTextNode(textNode)) {
                  textNode.setStyle(textNode.getStyle() + extraStyles);
                }
                return textNode;
              },
            };
          }
          return output;
        },
      };
    };
  }

  return importMap;
}

function App(): JSX.Element {
  const {
    settings: {isCollab, emptyEditor, measureTypingPerf},
  } = useSettings();

  const initialConfig = {
    editorState: isCollab
      ? null
      : emptyEditor
      ? undefined
      : $prepopulatedRichText,
    html: {import: buildImportMap()},
    namespace: 'Playground',
    nodes: [...PlaygroundNodes],
    onError: (error: Error) => {
      throw error;
    },
    theme: PlaygroundEditorTheme,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <SharedHistoryContext>
        <TableContext>
          <ToolbarContext>
            <DocumentHead />
            <header>
              <a href="https://tiles.run" target="_blank" rel="noreferrer">
                <Image
                  src="/icon.png"
                  alt="Lexical Logo"
                  width={32}
                  height={32}
                  style={{height: 'auto', width: '32px'}}
                />
              </a>
            </header>
            <div className="editor-shell">
              <Editor />
            </div>
            <Settings />
            {/*isDevPlayground ? <DocsPlugin /> : null */}
            {/*isDevPlayground ? <PasteLogPlugin /> : null*/}
            {/*isDevPlayground ? <TestRecorderPlugin /> : null*/}

            {measureTypingPerf ? <TypingPerfPlugin /> : null}
          </ToolbarContext>
        </TableContext>
      </SharedHistoryContext>
      <footer
        style={{
          borderTop: '1px solid #eee',
          color: '#666',
          fontSize: '14px',
          marginTop: '20px',
          padding: '20px',
          textAlign: 'center',
        }}>
        <p>
        <a href="https://github.com/tileshq/tiles" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>Github</a>
        {' • '}
          <a href="https://x.com/tilesnotebook" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>X/Twitter</a>
          {' • '}
          <a href="https://blog.tiles.run/" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>Blog</a>
          {' • '}
          <a href="https://tiles.run/shared/RYcEAFb16btn8a7SKx3bV" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>Terms</a>
        </p>
        <p>
          Check out <a href="https://tilekit.dev" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>Tilekit</a> for the personal software toolkit.
        </p>
        <p>
          Designed and built by <a href="https://ankeshbharti.com" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>@feynon</a> and <a href="https://aswinc.blog" target="_blank" rel="noreferrer" style={{color: '#007bff', textDecoration: 'none'}}>@chandanaveli</a>.
        </p>
      </footer>
    </LexicalComposer>
  );
}

export default App;