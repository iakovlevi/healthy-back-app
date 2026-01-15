import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './app';

describe('AuthScreen', () => {
    it('submits login and calls onLogin', async () => {
        const apiClient = jest.fn().mockResolvedValue({
            token: 'token-1',
            user: { email: 'a@b.com' }
        });
        const onLogin = jest.fn();
        const { container } = render(<AuthScreen onLogin={onLogin} apiClient={apiClient} />);
        const user = userEvent.setup();

        const emailInput = container.querySelector('input[type="email"]');
        const passwordInput = container.querySelector('input[type="password"]');
        const submitButton = container.querySelector('button[type="submit"]');
        await act(async () => {
            await user.type(emailInput, 'a@b.com');
            await user.type(passwordInput, 'pass');
            await user.click(submitButton);
        });

        await waitFor(() => expect(onLogin).toHaveBeenCalledWith('token-1', { email: 'a@b.com' }));
        expect(apiClient).toHaveBeenCalledWith('/auth/login', 'POST', { email: 'a@b.com', password: 'pass' });
    });

    it('shows error message when auth fails', async () => {
        const apiClient = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
        const onLogin = jest.fn();
        const { container } = render(<AuthScreen onLogin={onLogin} apiClient={apiClient} />);
        const user = userEvent.setup();

        const emailInput = container.querySelector('input[type="email"]');
        const passwordInput = container.querySelector('input[type="password"]');
        const submitButton = container.querySelector('button[type="submit"]');
        await act(async () => {
            await user.type(emailInput, 'a@b.com');
            await user.type(passwordInput, 'pass');
            await user.click(submitButton);
        });

        await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
        expect(onLogin).not.toHaveBeenCalled();
    });
});
