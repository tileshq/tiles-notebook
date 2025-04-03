/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useEffect} from 'react';

export default function DocumentHead(): null {
  useEffect(() => {
    // Set document title
    document.title = 'Tiles';

    // Set favicon
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = '/images/logo.svg';
      favicon.type = 'image/svg+xml';
    } else {
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/svg+xml';
      newFavicon.href = '/images/logo.svg';
      document.head.appendChild(newFavicon);
    }
  }, []);

  return null;
} 