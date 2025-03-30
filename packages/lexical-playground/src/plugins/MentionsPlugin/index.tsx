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
import {useCallback, useEffect, useMemo, useState} from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {$createMentionNode} from '../../nodes/MentionNode';

// Define the MCP Servlet interface
interface McpServlet {
  slug: string;
  name?: string;
  description?: string;
  // Add other relevant fields if needed
}

// Module-level cache for servlets
let servletCache: McpServlet[] | null = null;
let servletFetchPromise: Promise<McpServlet[]> | null = null;

// Debounce function
function debounce(fn: (...args: any[]) => void, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

// Function to fetch servlets with caching
async function fetchServlets(): Promise<McpServlet[]> {
  if (servletCache !== null) {
    return servletCache;
  }

  if (servletFetchPromise !== null) {
    return servletFetchPromise;
  }

  servletFetchPromise = (async () => {
    try {
      const response = await fetch('/api/servlets');
      if (!response.ok) {
        throw new Error(`MCP API error: ${response.statusText} (Status: ${response.status})`);
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response received from server');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Expected array of servlets but received: ' + typeof data);
      }
      
      servletCache = data;
      return data;
    } catch (err) {
      console.error("Error fetching MCP servlets:", err);
      throw err;
    } finally {
      servletFetchPromise = null;
    }
  })();

  return servletFetchPromise;
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

export default function NewMentionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [queryString, setQueryString] = useState<string | null>(null);
  const [servlets, setServlets] = useState<McpServlet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize servlets from cache or fetch them
  useEffect(() => {
    const initializeServlets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchServlets();
        setServlets(data);
      } catch (err) {
        console.error("Error initializing MCP servlets:", err);
        setError(err instanceof Error ? err.message : 'Failed to fetch servlets');
      } finally {
        setIsLoading(false);
      }
    };

    initializeServlets();
  }, []); // Empty dependency array ensures this runs only once on mount

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
      console.error('Servlets is not an array:', servlets);
      return [];
    }
    const query = queryString.toLowerCase();
    return servlets
      .filter((servlet) =>
        servlet.slug.toLowerCase().includes(query) ||
        (servlet.name && servlet.name.toLowerCase().includes(query)) ||
        (servlet.description && servlet.description.toLowerCase().includes(query))
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

  return (
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
  );
}
