'use client';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuTextMatch,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {$createTextNode, $getSelection, $isRangeSelection, TextNode} from 'lexical';
import {useCallback, useMemo, useState, useEffect} from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {$createMentionNode} from '../../nodes/MentionNode';
import { useMcpContext } from '../../contexts/McpContext';
import './index.css';

// Debounce function
function debounce(fn: (...args: any[]) => void, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

const PUNCTUATION =
  '\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>_:;';
const NAME = '\\b[A-Z][^\\s' + PUNCTUATION + ']';

const DocumentMentionsRegex = {
  NAME,
  PUNCTUATION,
};

const PUNC = DocumentMentionsRegex.PUNCTUATION;

const TRIGGERS = ['@'].join('');

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = '[^' + TRIGGERS + PUNC + '\\s]';

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS =
  '(?:' +
  '\\.[ |$]|' + // E.g. "r. " in "Mr. Smith"
  ' |' + // E.g. " " in "Josh Duck"
  '[' +
  PUNC +
  ']|' + // E.g. "-' in "Salier-Hellendag"
  ')';

const LENGTH_LIMIT = 75;

const AtSignMentionsRegex = new RegExp(
  '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    VALID_JOINS +
    '){0,' +
    LENGTH_LIMIT +
    '})' +
    ')$',
);

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50;

// Regex used to match alias.
const AtSignMentionsRegexAliasRegex = new RegExp(
  '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    '){0,' +
    ALIAS_LENGTH_LIMIT +
    '})' +
    ')$',
);

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 5;

function checkForAtSignMentions(
  text: string,
  minMatchLength: number,
): MenuTextMatch | null {
  let match = AtSignMentionsRegex.exec(text);

  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset
    const maybeLeadingWhitespace = match[1];

    const matchingString = match[3];
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2],
      };
    }
  }
  return null;
}

function getPossibleQueryMatch(text: string): MenuTextMatch | null {
  return checkForAtSignMentions(text, 1);
}

class MentionTypeaheadOption extends MenuOption {
  name: string;

  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

function MentionsTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: MentionTypeaheadOption;
}) {
  let className = 'item';
  if (isSelected) {
    className += ' selected';
  }
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <span className="text">{option.name}</span>
    </li>
  );
}

// Servlets Container Component
function ServletsContainer({ servlets, isLoading, error }: { 
  servlets: any[]; 
  isLoading: boolean; 
  error: string | null;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const insertMention = useCallback((slug: string) => {
    editor.update(() => {
      const mentionNode = $createMentionNode(slug);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([mentionNode]);
      }
    });
  }, [editor]);

  // Function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Filter servlets based on search query
  const filteredServlets = useMemo(() => {
    if (!searchQuery.trim()) return servlets;
    
    const query = searchQuery.toLowerCase();
    return servlets.filter(servlet => 
      servlet.slug.toLowerCase().includes(query) || 
      (servlet.name && servlet.name.toLowerCase().includes(query)) ||
      (servlet.meta?.description && servlet.meta.description.toLowerCase().includes(query))
    );
  }, [servlets, searchQuery]);

  return (
    <div className="servlets-container">
      <div className="servlets-header">
        <h3>Available Servlets</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search servlets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="empty-servlets-message">
          Loading servlets...
        </div>
      ) : error ? (
        <div className="empty-servlets-message">
          Error: {error}
        </div>
      ) : filteredServlets.length === 0 ? (
        <div className="empty-servlets-message">
          {searchQuery ? 'No servlets match your search' : 'No servlets available'}
        </div>
      ) : (
        <ul className="servlets-list">
          {filteredServlets.map((servlet) => (
            <li 
              key={servlet.slug} 
              className="servlet-item"
              onClick={() => insertMention(servlet.slug)}
            >
              <div className="servlet-name">@{servlet.slug || 'Unnamed Servlet'}</div>
              {servlet.meta?.description ? (
                <div className="servlet-description">
                  {truncateText(servlet.meta.description)}
                </div>
              ) : (
                <div className="servlet-description">
                  No description available
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewMentionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [showServlets, setShowServlets] = useState<boolean>(false);
  
  // Use the McpContext instead of managing state locally
  const { servlets, isLoading, error } = useMcpContext();

  const checkForMentionMatch = useBasicTypeaheadTriggerMatch('@', {
    minLength: 0, // Trigger immediately after '@'
  });

  // Debounced query string update
  const debouncedSetQueryString = useCallback(debounce(setQueryString, 200), []);

  const options = useMemo(() => {
    if (queryString === null || isLoading || error) {
      return [];
    }
    if (!Array.isArray(servlets)) {
      return [];
    }
    const query = queryString.toLowerCase();
    return servlets
      .filter((servlet) =>
        servlet.slug.toLowerCase().includes(query) ||
        (servlet.name && servlet.name.toLowerCase().includes(query)) ||
        (servlet.meta?.description && servlet.meta.description.toLowerCase().includes(query))
      )
      .map((servlet) => new MentionTypeaheadOption(servlet.slug)) // Use slug as the primary identifier/display
      .slice(0, SUGGESTION_LIST_LENGTH_LIMIT); // Limit results
  }, [servlets, queryString, isLoading, error]);

  const onSelectOption = useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const mentionNode = $createMentionNode(selectedOption.name); // Use the selected slug
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        } else {
           // Handle insertion if nodeToReplace is null (e.g., at the end of a line)
           const selection = $getSelection();
           if ($isRangeSelection(selection)) {
             // You might want more sophisticated logic here depending on desired behavior
             selection.insertNodes([mentionNode]);
           }
        }
        closeMenu();
      });
    },
    [editor],
  );

  // Display loading or error state in the typeahead menu if applicable
  const loadingOrErrorOption = useMemo(() => {
    if (isLoading) {
      // Create a simple text option for loading state
      return [new MentionTypeaheadOption('Loading servlets...')];
    }
    if (error) {
      // Create a simple text option for error state
      return [new MentionTypeaheadOption(`Error: ${error}`)];
    }
    return [];
  }, [isLoading, error]);

  // Combine actual options with loading/error state if necessary
  const displayOptions = isLoading || error ? loadingOrErrorOption : options;

  // Toggle servlets container visibility
  const toggleServlets = useCallback(() => {
    setShowServlets(prev => !prev);
  }, []);

  // Add button to toggle servlets container
  useEffect(() => {
    const button = document.createElement('button');
    button.id = 'servlets-button';
    button.title = 'Show Available Servlets';
    button.onclick = toggleServlets;
    document.body.appendChild(button);

    return () => {
      document.body.removeChild(button);
    };
  }, [toggleServlets]);

  // Update button active state
  useEffect(() => {
    const button = document.getElementById('servlets-button');
    if (button) {
      if (showServlets) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }, [showServlets]);

  return (
    <>
      <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
        onQueryChange={debouncedSetQueryString} // Use debounced update
        onSelectOption={onSelectOption}
        triggerFn={checkForMentionMatch}
        options={displayOptions} // Use combined options
        menuRenderFn={(
          anchorElementRef,
          {selectedIndex, selectOptionAndCleanUp, setHighlightedIndex},
        ) =>
          anchorElementRef.current && displayOptions.length > 0 // Only render if there are options or loading/error state
            ? ReactDOM.createPortal(
                <div className="typeahead-popover mentions-menu">
                  <ul>
                    {displayOptions.map((option, i: number) => (
                      <MentionsTypeaheadMenuItem
                        index={i}
                        isSelected={selectedIndex === i}
                        onClick={() => {
                          // Don't allow selection of loading/error messages
                          if (!isLoading && !error) {
                            setHighlightedIndex(i);
                            selectOptionAndCleanUp(option);
                          }
                        }}
                        onMouseEnter={() => {
                          if (!isLoading && !error) {
                             setHighlightedIndex(i);
                          }
                        }}
                        key={option.key}
                        option={option}
                      />
                    ))}
                  </ul>
                </div>,
                anchorElementRef.current,
              )
            : null
        }
      />
      {showServlets && (
        <ServletsContainer 
          servlets={servlets} 
          isLoading={isLoading} 
          error={error} 
        />
      )}
    </>
  );
}
