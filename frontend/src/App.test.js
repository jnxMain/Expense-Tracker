import { render, screen } from '@testing-library/react';
import App from './App';

test('requires an account before showing private tracker data', () => {
  localStorage.removeItem('jft-session');
  render(<App />);
  expect(screen.getByText('JNX Finance Tracker')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toBeInTheDocument();
});
