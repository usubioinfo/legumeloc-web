export interface ValidationResult {
  valid: boolean;
  error?: string;
  sequenceCount?: number;
  type?: 'protein' | 'nucleotide';
}

export function validateFasta(fastaText: string): ValidationResult {
  if (!fastaText || !fastaText.trim()) {
    return { valid: false, error: 'FASTA sequence content is empty.' };
  }

  const lines = fastaText.trim().split(/\r?\n/);
  let headerCount = 0;
  let sequenceChars = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      headerCount++;
    } else if (trimmed.length > 0) {
      sequenceChars += trimmed.toUpperCase();
    }
  }

  if (headerCount === 0) {
    return {
      valid: false,
      error: 'Invalid FASTA format. Sequences must start with a ">" header line.',
    };
  }

  if (headerCount > 10000) {
    return {
      valid: false,
      error: `Exceeded maximum sequence limit. Provided ${headerCount} sequences (maximum allowed: 10,000).`,
    };
  }

  // Check if non-amino acid characters exist
  const nonAaMatches = sequenceChars.replace(/[^A-Z]/g, '');
  if (nonAaMatches.length === 0) {
    return { valid: false, error: 'Sequence contains invalid characters.' };
  }

  return {
    valid: true,
    sequenceCount: headerCount,
    type: 'protein',
  };
}
