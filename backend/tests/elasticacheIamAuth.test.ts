import { beforeEach, describe, expect, it, vi } from 'vitest';

const aws = vi.hoisted(() => {
  const credentialsProvider = vi.fn().mockResolvedValue({
    accessKeyId: 'AKIAFAKEFORTESTS',
    secretAccessKey: 'fake-secret-for-local-signing-only',
    sessionToken: 'fake-session-token',
  });
  return {
    credentialsProvider,
    defaultProvider: vi.fn(() => credentialsProvider),
  };
});

vi.mock('@aws-sdk/credential-provider-node', () => ({ defaultProvider: aws.defaultProvider }));

import { createElastiCacheIamToken } from '../src/config/elasticacheIamAuth';

const input = {
  cacheName: 'Finance-AI-Staging-Valkey',
  region: 'ap-south-1',
  username: 'finance-ai-staging-valkey-app',
};

beforeEach(() => {
  aws.credentialsProvider.mockClear();
});

describe('ElastiCache IAM auth token generation', () => {
  it('uses the AWS default credential provider and official SigV4 query signing', async () => {
    const token = await createElastiCacheIamToken(input);
    const signedUrl = new URL(`https://${token}`);

    expect(aws.credentialsProvider).toHaveBeenCalledOnce();
    expect(signedUrl.hostname).toBe(input.cacheName.toLowerCase());
    expect(signedUrl.searchParams.get('Action')).toBe('connect');
    expect(signedUrl.searchParams.get('User')).toBe(input.username);
    expect(signedUrl.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(signedUrl.searchParams.get('X-Amz-Credential')).toContain(
      `/${input.region}/elasticache/aws4_request`
    );
    expect(signedUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
    expect(token).not.toContain('fake-secret-for-local-signing-only');
  });

  it('supports injected credential and signing boundaries without real AWS credentials', async () => {
    const credentials = {
      accessKeyId: 'INJECTED',
      secretAccessKey: 'injected-secret',
    };
    const credentialsProvider = vi.fn().mockResolvedValue(credentials);
    const presign = vi.fn(async request => {
      request.query = { ...request.query, 'X-Amz-Signature': 'injected-signature' };
      return request;
    });

    const token = await createElastiCacheIamToken(input, { credentialsProvider, presign });

    expect(credentialsProvider).toHaveBeenCalledOnce();
    expect(presign).toHaveBeenCalledWith(expect.anything(), credentials, input.region);
    expect(token).toContain('X-Amz-Signature=injected-signature');
    expect(aws.credentialsProvider).not.toHaveBeenCalled();
  });
});
