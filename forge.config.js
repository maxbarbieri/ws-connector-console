module.exports = {
  packagerConfig: {
    asar: true,
    arch: ['x64', 'arm64'],
    platform: ['darwin', 'linux']
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {},
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      platforms: ['darwin', 'linux'],
      config: {
        repository: {
          owner: 'maxbarbieri',
          name: 'ws-connector-console'
        },
        prerelease: true
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
