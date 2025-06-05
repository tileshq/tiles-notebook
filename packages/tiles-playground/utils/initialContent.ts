import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
} from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createMentionNode } from '../nodes/MCPServerletNode';
import { $createLinkNode } from '@lexical/link';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';


export function $prepopulatedRichText() {
  const root = $getRoot();
  if (root.getFirstChild() === null) {
    // Add heading
    const heading = $createHeadingNode('h1');
    heading.append($createTextNode('Hello, this is tiles.'));
    root.append(heading);

    // Add first paragraph
    const paragraph1 = $createParagraphNode();
    paragraph1.append(
      $createTextNode('Tiles is a notebook interface that makes working with AI agents easier. It\'s a multiplayer, offline-first expereince based on MCP with support for generating widgets/artifacts.')
    );
    root.append(paragraph1);

    // Add a new paragraph blank line
    const blankLine = $createParagraphNode();
    root.append(blankLine);

    // Add second paragraph
    const paragraph2 = $createParagraphNode();
    paragraph2.append(
      $createTextNode('Our vision is to make personal software ubiquitous in the future.')
    );
    root.append(paragraph2);

    // Add a new paragraph blank line
    const blankLine3 = $createParagraphNode();
    root.append(blankLine3);

    // Add a paragraph with some text
    const paragraph3 = $createParagraphNode();
    paragraph3.append(
      $createTextNode('For example, you can ask:')
    );
    root.append(paragraph3);

    // Add a horizontal line
    const horizontalLine = $createHorizontalRuleNode();
    root.append(horizontalLine);

    // Add MCP Serverlet example
    const paragraph4 = $createParagraphNode();
    const mentionNode = $createMentionNode('dylibso/eval-py');
    paragraph4.append(mentionNode);
    paragraph4.append($createTextNode(' My current left balance and financial analysis: Balance As of 5th April Bank: 87150 Credit debt (ICICI+HDFC+AXIS): 47504 + 35000 + 25732 ,  Splitwise debt: -261295. Draw a diagram to show how my money was spent and how much is left.'));
    root.append(paragraph4);

    // Add a horizontal line
    const horizontalLine2 = $createHorizontalRuleNode();
    root.append(horizontalLine2);

    // Add a paragraph with text
    const paragraph5 = $createParagraphNode();
    paragraph5.append(
      $createTextNode('Then, place the cursor on the line above, and click the \`Run Tiles\` button to have the agent process it. '),
      $createTextNode('To share this document, use the airplane icon in the top-right corner.'),
    );
    root.append(paragraph5);

    // Add a new paragraph blank line
    const blankLine4 = $createParagraphNode();
    root.append(blankLine4);


    // Add final paragraph
    const paragraph6  = $createParagraphNode();
    paragraph6.append(
      $createTextNode('We\'re constantly refining and adding new features, checkout our '),
      $createLinkNode('https://blog.tiles.run/').append(
        $createTextNode('blog.')
      ),

    );
    root.append(paragraph6);

    // Add a new paragraph blank line
    const blankLine5 = $createParagraphNode();
    root.append(blankLine5);


  }
} 