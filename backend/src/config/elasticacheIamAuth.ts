import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';

const TOKEN_TTL_SECONDS = 15 * 60;
const defaultCredentialsProvider = defaultProvider();

type CredentialProvider = ReturnType<typeof defaultProvider>;
type AwsCredentials = Awaited<ReturnType<CredentialProvider>>;
type SignableHttpRequest = Parameters<SignatureV4['presign']>[0];
type SignedHttpRequest = Awaited<ReturnType<SignatureV4['presign']>>;

export type ElastiCacheIamTokenInput = {
  cacheName: string;
  region: string;
  username: string;
};

type TokenDependencies = {
  credentialsProvider?: CredentialProvider;
  presign?: (
    request: SignableHttpRequest,
    credentials: AwsCredentials,
    region: string
  ) => Promise<SignedHttpRequest>;
};

async function presign(
  request: SignableHttpRequest,
  credentials: AwsCredentials,
  region: string
): Promise<SignedHttpRequest> {
  return new SignatureV4({
    credentials,
    region,
    service: 'elasticache',
    sha256: Sha256,
  }).presign(request, { expiresIn: TOKEN_TTL_SECONDS });
}

function formatToken(request: SignedHttpRequest): string {
  const url = new URL(`${request.protocol}//${request.hostname}${request.path}`);
  for (const name of Object.keys(request.query ?? {}).sort()) {
    const value = request.query?.[name];
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(name, item);
    } else if (value !== null && value !== undefined) {
      url.searchParams.append(name, value);
    }
  }
  return `${url.host}${url.pathname}${url.search}`;
}

export async function createElastiCacheIamToken(
  { cacheName, region, username }: ElastiCacheIamTokenInput,
  dependencies: TokenDependencies = {}
): Promise<string> {
  const signingHost = cacheName.toLowerCase();
  const request: SignableHttpRequest = {
    method: 'GET',
    protocol: 'https:',
    hostname: signingHost,
    path: '/',
    headers: { host: signingHost },
    query: { Action: 'connect', User: username },
  };
  const credentials = await (dependencies.credentialsProvider ?? defaultCredentialsProvider)();
  const signedRequest = await (dependencies.presign ?? presign)(request, credentials, region);

  return formatToken(signedRequest);
}
