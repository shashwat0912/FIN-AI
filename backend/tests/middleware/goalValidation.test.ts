import { describe, expect, it } from 'vitest';
import { goalSchemas } from '../../src/middleware/validation';

const validGoal = {
  name: 'Emergency fund',
  targetAmount: 100000,
  targetDate: '2027-07-16',
};

describe('goal validation', () => {
  it('accepts a goal without a description', () => {
    const { error } = goalSchemas.create.validate(validGoal);

    expect(error).toBeUndefined();
  });

  it('accepts an empty description from the optional form field', () => {
    const { error, value } = goalSchemas.create.validate({
      ...validGoal,
      description: '',
    });

    expect(error).toBeUndefined();
    expect(value.description).toBe('');
  });

  it('preserves a supplied description', () => {
    const description = 'Six months of essential expenses';
    const { error, value } = goalSchemas.create.validate({
      ...validGoal,
      description,
    });

    expect(error).toBeUndefined();
    expect(value.description).toBe(description);
  });

  it('allows an existing description to be cleared', () => {
    const { error, value } = goalSchemas.update.validate({ description: '' });

    expect(error).toBeUndefined();
    expect(value.description).toBe('');
  });
});
