'use client';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {Provider} from '@lexical/yjs';
import {WebsocketProvider} from 'y-websocket';
import {Doc} from 'yjs';

const getWebsocketEndpoint = (): string => {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    return params.get("collabEndpoint") || "ws://localhost:1234";
  }
  return "ws://localhost:1234";
};

const getWebsocketId = (): string => {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    return params.get("collabId") || "0";
  }
  return "0";
};

//const WEBSOCKET_ENDPOINT = getWebsocketEndpoint();
//const WEBSOCKET_SLUG = "playground";
//const WEBSOCKET_ID = getWebsocketId();
const WEBSOCKET_ENDPOINT = getWebsocketEndpoint();
const WEBSOCKET_SLUG = 'playground';
const WEBSOCKET_ID = getWebsocketId();

// parent dom -> child doc
export function createWebsocketProvider(
  id: string,
  yjsDocMap: Map<string, Doc>,
): Provider {
  let doc = yjsDocMap.get(id);

  if (doc === undefined) {
    doc = new Doc();
    yjsDocMap.set(id, doc);
  } else {
    doc.load();
  }

  // @ts-expect-error
  return new WebsocketProvider(
    WEBSOCKET_ENDPOINT,
    WEBSOCKET_SLUG + '/' + WEBSOCKET_ID + '/' + id,
    doc,
    {
      connect: false,
    },
  );
}
