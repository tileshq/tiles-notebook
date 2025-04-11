'use client';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {TableOfContentsEntry} from '@lexical/react/LexicalTableOfContentsPlugin';
import type {HeadingTagType} from '@lexical/rich-text';
import type {NodeKey} from 'lexical';

import './index.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {TableOfContentsPlugin as LexicalTableOfContentsPlugin} from '@lexical/react/LexicalTableOfContentsPlugin';
import {useEffect, useRef, useState} from 'react';
import * as React from 'react';

const MARGIN_ABOVE_EDITOR = 624;
const HEADING_WIDTH = 9;

// Enhanced heading types to track
type HeadingType = HeadingTagType | 'list' | 'table' | 'code' | 'quote';

function getHeadingType(node: any): HeadingType {
  // Check if node is a heading tag
  if (typeof node === 'string' && (node === 'h1' || node === 'h2' || node === 'h3')) {
    return node;
  }
  
  // For other node types, we need to check the node type property
  if (node && typeof node === 'object') {
    // If it's a heading node with a tag property
    if (node.tag && (node.tag === 'h1' || node.tag === 'h2' || node.tag === 'h3')) {
      return node.tag;
    }
    
    // For other node types
    if (node.type) {
      if (node.type === 'list') return 'list';
      if (node.type === 'table') return 'table';
      if (node.type === 'code') return 'code';
      if (node.type === 'quote') return 'quote';
    }
  }
  
  // Default to h1 if we can't determine the type
  return 'h1';
}

function indent(type: HeadingType) {
  switch (type) {
    case 'h1':
      return 'heading1';
    case 'h2':
      return 'heading2';
    case 'h3':
      return 'heading3';
    case 'list':
      return 'list-item';
    case 'table':
      return 'table-item';
    case 'code':
      return 'code-item';
    case 'quote':
      return 'quote-item';
    default:
      return '';
  }
}

function isHeadingAtTheTopOfThePage(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0].y;
  return (
    elementYPosition >= MARGIN_ABOVE_EDITOR &&
    elementYPosition <= MARGIN_ABOVE_EDITOR + HEADING_WIDTH
  );
}
function isHeadingAboveViewport(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0].y;
  return elementYPosition < MARGIN_ABOVE_EDITOR;
}
function isHeadingBelowTheTopOfThePage(element: HTMLElement): boolean {
  const elementYPosition = element?.getClientRects()[0].y;
  return elementYPosition >= MARGIN_ABOVE_EDITOR + HEADING_WIDTH;
}

function TableOfContentsList({
  tableOfContents,
}: {
  tableOfContents: Array<TableOfContentsEntry>;
}): JSX.Element {
  const [selectedKey, setSelectedKey] = useState('');
  const selectedIndex = useRef(0);
  const [editor] = useLexicalComposerContext();
  const [isExpanded, setIsExpanded] = useState(true);

  // Add debugging to understand the structure
  useEffect(() => {
    if (tableOfContents.length > 0) {
      console.log('Table of Contents Structure:', tableOfContents);
      console.log('First entry:', tableOfContents[0]);
    }
  }, [tableOfContents]);

  function scrollToNode(key: NodeKey, currIndex: number) {
    editor.getEditorState().read(() => {
      const domElement = editor.getElementByKey(key);
      if (domElement !== null) {
        domElement.scrollIntoView({ behavior: 'smooth' });
        setSelectedKey(key);
        selectedIndex.current = currIndex;
      }
    });
  }

  useEffect(() => {
    function scrollCallback() {
      if (
        tableOfContents.length !== 0 &&
        selectedIndex.current < tableOfContents.length - 1
      ) {
        let currentHeading = editor.getElementByKey(
          tableOfContents[selectedIndex.current][0],
        );
        if (currentHeading !== null) {
          if (isHeadingBelowTheTopOfThePage(currentHeading)) {
            //On natural scroll, user is scrolling up
            while (
              currentHeading !== null &&
              isHeadingBelowTheTopOfThePage(currentHeading) &&
              selectedIndex.current > 0
            ) {
              const prevHeading = editor.getElementByKey(
                tableOfContents[selectedIndex.current - 1][0],
              );
              if (
                prevHeading !== null &&
                (isHeadingAboveViewport(prevHeading) ||
                  isHeadingBelowTheTopOfThePage(prevHeading))
              ) {
                selectedIndex.current--;
              }
              currentHeading = prevHeading;
            }
            const prevHeadingKey = tableOfContents[selectedIndex.current][0];
            setSelectedKey(prevHeadingKey);
          } else if (isHeadingAboveViewport(currentHeading)) {
            //On natural scroll, user is scrolling down
            while (
              currentHeading !== null &&
              isHeadingAboveViewport(currentHeading) &&
              selectedIndex.current < tableOfContents.length - 1
            ) {
              const nextHeading = editor.getElementByKey(
                tableOfContents[selectedIndex.current + 1][0],
              );
              if (
                nextHeading !== null &&
                (isHeadingAtTheTopOfThePage(nextHeading) ||
                  isHeadingAboveViewport(nextHeading))
              ) {
                selectedIndex.current++;
              }
              currentHeading = nextHeading;
            }
            const nextHeadingKey = tableOfContents[selectedIndex.current][0];
            setSelectedKey(nextHeadingKey);
          }
        }
      } else {
        selectedIndex.current = 0;
      }
    }
    let timerId: ReturnType<typeof setTimeout>;

    function debounceFunction(func: () => void, delay: number) {
      clearTimeout(timerId);
      timerId = setTimeout(func, delay);
    }

    function onScroll(): void {
      debounceFunction(scrollCallback, 10);
    }

    document.addEventListener('scroll', onScroll);
    return () => document.removeEventListener('scroll', onScroll);
  }, [tableOfContents, editor]);

  return (
    <div className="table-of-contents">
      <div className="toc-header">
        <h3>Outline</h3>
      </div>
      {isExpanded && (
        <>
          {tableOfContents.length === 0 ? (
            <div className="empty-toc-message">
              Write something to get started
            </div>
          ) : (
            <ul className="headings">
              {tableOfContents.map(([key, text, tag], index) => {
                // Safely get the heading type
                const headingType = getHeadingType(tag);
                
                // For debugging
                if (index === 0) {
                  console.log('First item tag:', tag);
                  console.log('First item heading type:', headingType);
                }
                
                if (index === 0) {
                  return (
                    <div className="normal-heading-wrapper" key={key}>
                      <div
                        className="first-heading"
                        onClick={() => scrollToNode(key, index)}
                        role="button"
                        tabIndex={0}>
                        {('' + text).length > 20
                          ? text.substring(0, 20) + '...'
                          : text}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      className={`normal-heading-wrapper ${
                        selectedKey === key ? 'selected-heading-wrapper' : ''
                      }`}
                      key={key}>
                      <div
                        onClick={() => scrollToNode(key, index)}
                        role="button"
                        className={indent(headingType)}
                        tabIndex={0}>
                        <li
                          className={`normal-heading ${
                            selectedKey === key ? 'selected-heading' : ''
                          }`}>
                          {('' + text).length > 27
                            ? text.substring(0, 27) + '...'
                            : text}
                        </li>
                      </div>
                    </div>
                  );
                }
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function TableOfContentsPlugin() {
  return (
    <LexicalTableOfContentsPlugin>
      {(tableOfContents) => {
        return <TableOfContentsList tableOfContents={tableOfContents} />;
      }}
    </LexicalTableOfContentsPlugin>
  );
}
