export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api',
  useMockApi: process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false',
  web3formsAccessKey: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ?? '',
} as const;
