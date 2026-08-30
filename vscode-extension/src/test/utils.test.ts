import * as assert from 'assert';
import { estimateTokenCount, exceedsTokenLimit } from '../utils';

suite('Utils Test Suite', () => {
    test('estimateTokenCount should return 0 for an empty string', () => {
        assert.strictEqual(estimateTokenCount(''), 0);
    });

    test('estimateTokenCount should estimate approximately 4 characters per token', () => {
        const text = 'test'; // 4 characters
        assert.strictEqual(estimateTokenCount(text), 1);
    });

    test('estimateTokenCount should estimate 100 tokens for 400 characters', () => {
        const text = 'a'.repeat(400); // 400 characters
        assert.strictEqual(estimateTokenCount(text), 100);
    });

    test('exceedsTokenLimit should return false for short text below the 3000 token limit', () => {
        const shortText = 'hello world';
        assert.strictEqual(exceedsTokenLimit(shortText), false);
    });

    test('exceedsTokenLimit should return true for long text well above the 3000 token limit', () => {
        const longText = 'a'.repeat(15000); // way over the 3000 token limit
        assert.strictEqual(exceedsTokenLimit(longText), true);
    });
});



