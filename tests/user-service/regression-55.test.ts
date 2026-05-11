import { loadConfig } from '../src/config';

describe('User Service Config', () => {
  it('should load valid config with default port and dependencies if backup is missing', async () => {
    const mockFs = jest.mock('fs');
    mockFs.existsSync.mockReturnValue(false);

    mockFs.readFileSync.mockImplementationOnce(() => JSON.stringify({ port: 3000, dependencies: [] }));

    const config = await loadConfig();

    expect(config.port).toBe(3000);
    expect(config.dependencies.length).toBe(0);
  });

  it('should load valid config with default port and dependencies if backup exists', async () => {
    const mockFs = jest.mock('fs');
    mockFs.existsSync.mockReturnValue(true);

    mockFs.readFileSync.mockImplementationOnce(() => JSON.stringify({ port: 3000, dependencies: [] }));

    const config = await loadConfig();

    expect(config.port).toBe(3000);
    expect(config.dependencies.length).toBe(0);
  });
});