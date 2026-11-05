import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest sem `globals`: o Testing Library não registra o cleanup sozinho.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
