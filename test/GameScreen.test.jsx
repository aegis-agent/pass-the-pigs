import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { GameScreen } from '../src/App.jsx';

afterEach(() => cleanup());

const baseGame = () => ({
  n: 1, ruleset: { startingScore: 0, pigOutPenalty: 0, oinker: 'wipeTotal',
    offTable: 'off', piggyback: 'eliminate', kissingBacon: false,
    hogCall: false, suddenDeath: false,
    winCondition: { type: 'targetScore', target: 100 } },
  order: ['a','b'], scores: { a:0, b:0 }, eliminated: [], turnIndex: 0,
  pot: 0, rolls: [], turnsTaken: 0, targetReachedAt: null, targetReachedBy: null,
  pendingHogCall: null, reachedTarget: [], roundScores: [],
  status: 'playing', winnerId: null, loserId: null, tie: false,
});

const makeById = () => (id) => ({ name: 'Test', avatar: '🐷', color: '#FF6B6B' });

describe('Pig buttons (ADD dispatch)', () => {
  it('Razorback +5', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByText('Razorback').closest('button'));
    expect(d).toHaveBeenCalledWith({ type: 'ADD', key: 'razorback', pts: 5 });
  });

  it('Snouter +10', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByText('Snouter').closest('button'));
    expect(d).toHaveBeenCalledWith({ type: 'ADD', key: 'snouter', pts: 10 });
  });

  it('Double Jowler +60', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByText('Double Jowler').closest('button'));
    expect(d).toHaveBeenCalledWith({ type: 'ADD', key: 'dbl_jowler', pts: 60 });
  });
});

describe('Manual score (MANUAL_BANK)', () => {
  it('Bank it dispatches MANUAL_BANK with typed value', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    const input = screen.getByPlaceholderText('Score');
    await userEvent.setup().type(input, '7');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bank it' }));
    expect(d).toHaveBeenCalledWith({ type: 'MANUAL_BANK', amount: 7 });
  });

  it('+0 dispatches MANUAL_BANK with amount 0', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '+0' }));
    expect(d).toHaveBeenCalledWith({ type: 'MANUAL_BANK', amount: 0 });
  });

  it('does NOT dispatch MANUAL_BANK when input is empty', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bank it' }));
    expect(d).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'MANUAL_BANK' }));
  });

  it('reads DOM value via ref (bypasses stale React state)', async () => {
    const d = vi.fn();
    const { container } = render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    const input = container.querySelector('input[type=number]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '12');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bank it' }));
    expect(d).toHaveBeenCalledWith({ type: 'MANUAL_BANK', amount: 12 });
  });
});

describe('Danger buttons', () => {
  it('Pig Out dispatches PIG_OUT', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Pig Out/ }));
    expect(d).toHaveBeenCalledWith({ type: 'PIG_OUT' });
  });

  it('Oinker dispatches OINKER', async () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Oinker/ }));
    expect(d).toHaveBeenCalledWith({ type: 'OINKER' });
  });
});

describe('Bank button', () => {
  it('disabled when pot is 0', () => {
    const d = vi.fn();
    render(<GameScreen game={baseGame()} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Bank$/ })).toBeDisabled();
  });

  it('dispatches BANK when pot > 0', async () => {
    const d = vi.fn();
    render(<GameScreen game={{...baseGame(), pot: 25}} byId={makeById()} dispatch={d} onMenu={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Bank 25/ }));
    expect(d).toHaveBeenCalledWith({ type: 'BANK' });
  });
});
