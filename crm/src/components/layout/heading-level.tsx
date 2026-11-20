'use client';

import { createContext, useContext } from 'react';

/** An area layout owns the page's h1, so headers nested inside it render as h2. */
const HeadingLevelContext = createContext<'h1' | 'h2'>('h1');

export const HeadingLevelProvider = HeadingLevelContext.Provider;
export const usePageHeadingTag = () => useContext(HeadingLevelContext);
