'use client';

import React from 'react';
import { useMcpContext } from '../../contexts/McpContext';

export default function ServletsDisplayPlugin(): JSX.Element | null {
  const { servlets, isLoading, error } = useMcpContext();

  if (isLoading) {
    return <div>Loading servlets...</div>;
  }

  if (error) {
    return <div>Error loading servlets: {error}</div>;
  }

  return (
    <div className="servlets-display">
      <h3>Available Servlets ({servlets.length})</h3>
      <ul>
        {servlets.map((servlet) => (
          <li key={servlet.slug}>
            <strong>{servlet.name || servlet.slug}</strong>
            {servlet.description && <p>{servlet.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
} 