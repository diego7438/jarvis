// Pure utility functions - no VS Code API dependencies
// This makes it easy to test in isolation

/** 
 * Rough token estimate for text sent to the local model.
 * Real tokenization is complex but ~4 characters per token usually
 * is a reasonable approximation for English text
 */

export function estimateTokenCount(text: string): number {
    if (!text) {
        return 0;
    }
    return Math.ceil(text.length / 4);
}

/**
 * Checks if a given text would exceed our safe context window budget.
 * We reserve some room for the system prompt and conversation history.
 */

export function exceedsTokenLimit(text: string, limit: number = 3000): boolean {
    return estimateTokenCount(text) > limit;
}