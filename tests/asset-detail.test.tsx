import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AssetDetailPage from '@/app/admin/assets/[assetId]/[version]/page';
import { PublishedAssetCard } from '@/components/admin/PublishedAssetCard';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import { getPublishedVersions, type PublishedAsset } from '@/lib/assets/published';
import { PUBLISHED_RENDERER } from '@/lib/assets/types';
import { TEST_USER } from './setup-auth';

vi.mock('@/lib/assets/published', () => ({ getPublishedVersions: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const params = (assetId: string, version: string) => ({ params: Promise.resolve({ assetId, version }) });

describe('published asset details', () => {
  it('links builtin cards to their exact version and displays its detail', async () => {
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const entry = ASSET_REGISTRY[0];
    const card = renderToStaticMarkup(<PublishedAssetCard entry={entry} />);
    expect(card).toContain(`/admin/assets/${entry.assetId}/${entry.version}`);
    const html = renderToStaticMarkup(await AssetDetailPage(params(entry.assetId, entry.version)));
    expect(html).toContain(`Detail ${entry.label}`);
    expect(html).toContain('Informasi aset');
    expect(getPublishedVersions).not.toHaveBeenCalled();
  });

  it('uses the published snapshot and links to its source draft version', async () => {
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const entry = { ...ASSET_REGISTRY[0], assetId: 'custom.test', version: '0.1.0', renderer: PUBLISHED_RENDERER,
      published: { id: 'pub', draftId: 'source', draftVersion: 2, publishedAt: 1, publishedBy: null } };
    vi.mocked(getPublishedVersions).mockResolvedValue([{ entry, previews: [], code: '', status: 'deprecated' } satisfies PublishedAsset]);
    const html = renderToStaticMarkup(await AssetDetailPage(params(entry.assetId, entry.version)));
    expect(getPublishedVersions).toHaveBeenCalledWith([{ assetId: entry.assetId, version: entry.version }]);
    expect(html).toContain('/admin/assets/draft/source?v=2');
    expect(html).toContain('Pratinjau belum tersedia');
  });

  it('returns not found for unknown versions', async () => {
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    vi.mocked(getPublishedVersions).mockResolvedValue([]);
    await expect(AssetDetailPage(params('missing', '9.0.0'))).rejects.toThrow('NOT_FOUND');
  });

  it('hides details from non-admins before looking up published code', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'someone-else@example.com');
    await expect(AssetDetailPage(params('custom.test', '0.1.0'))).rejects.toThrow('NOT_FOUND');
    expect(getPublishedVersions).not.toHaveBeenCalled();
  });
});
