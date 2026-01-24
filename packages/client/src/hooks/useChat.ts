/**
 * useChat Hook - Handles AI assistant chat with real API
 */

import { useState, useCallback } from 'react';
import { api } from '../api';
import { useGameStore, useChatMessages, useIsAssistantTyping } from '../stores';

export function useChat() {
  const gameId = useGameStore((state) => state.gameId);
  const chatMessages = useChatMessages();
  const isTyping = useIsAssistantTyping();
  const setAssistantTyping = useGameStore((state) => state.setAssistantTyping);
  const addAssistantMessage = useGameStore((state) => state.addAssistantMessage);

  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!gameId) {
      setError('No game loaded');
      return;
    }

    setError(null);
    setAssistantTyping(true);

    // Add user message to store
    useGameStore.getState().chatMessages.push({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    try {
      const result = await api.sendChatMessage(gameId, content, 'assistant');
      
      if (result.error) {
        setError(result.error);
        addAssistantMessage('I apologize, I encountered an error processing your request.');
      } else if (result.data) {
        addAssistantMessage(result.data.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      addAssistantMessage('I apologize, there was a connection error.');
    } finally {
      setAssistantTyping(false);
    }
  }, [gameId, setAssistantTyping, addAssistantMessage]);

  const analyzeMarket = useCallback(async () => {
    if (!gameId) return null;

    setAssistantTyping(true);
    try {
      const result = await api.analyzeMarket(gameId);
      if (result.data) {
        addAssistantMessage(
          `📊 **Market Analysis**\n\n${result.data.summary}\n\n**Recommendations:**\n${result.data.recommendations.map(r => `• ${r}`).join('\n')}`
        );
        return result.data;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAssistantTyping(false);
    }
    return null;
  }, [gameId, setAssistantTyping, addAssistantMessage]);

  const evaluateResearch = useCallback(async (prompt: string, budget: number) => {
    if (!gameId) return null;

    setAssistantTyping(true);
    try {
      const result = await api.evaluateResearch(gameId, prompt, budget);
      if (result.data) {
        const { feasibility, estimatedCost, estimatedTicks, risks, potentialEffects, sideEffects } = result.data;
        addAssistantMessage(
          `🔬 **Research Evaluation: "${prompt}"**\n\n` +
          `**Feasibility:** ${(feasibility * 100).toFixed(0)}%\n` +
          `**Estimated Cost:** $${(estimatedCost / 100).toLocaleString()}\n` +
          `**Duration:** ${estimatedTicks} days\n\n` +
          `**Risks:**\n${risks.map(r => `⚠️ ${r}`).join('\n')}\n\n` +
          `**Expected Effects:**\n${potentialEffects.map(e => `✅ ${e}`).join('\n')}\n\n` +
          `**Potential Side Effects:**\n${sideEffects.map(s => `❗ ${s}`).join('\n')}`
        );
        return result.data;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setAssistantTyping(false);
    }
    return null;
  }, [gameId, setAssistantTyping, addAssistantMessage]);

  return {
    messages: chatMessages,
    isTyping,
    error,
    sendMessage,
    analyzeMarket,
    evaluateResearch,
  };
}