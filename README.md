# ws-connector-console

## Installation
Download the latest release for your operating system from https://github.com/maxbarbieri/ws-connector-console/releases.

### macOS
On macOS, all downloaded files are tagged with a "com.apple.quarantine" attribute that prevents it from being opened.
If you try to open the app right after downloading it, macOS will show you a warning message saying that the application is damaged.
To avoid this you can run the following command on the downloaded zip file.
```sh
xattr -d com.apple.quarantine ws-connector-console-darwin-*.zip
```

You can then unzip the app with the following command (replace the file name with the actual name of the downloaded zip file):
```sh
unzip ws-connector-console-darwin-arm64-0.0.1.zip
```

You may then move the app wherever you want (usually to the `/Applications` directory).

In macOS the application binary is not automatically added to the PATH, you can either:
- Add the ws-connector-console binary directory to your PATH by adding the command `export PATH="/Applications/ws-connector-console.app/Contents/MacOS/:$PATH"` to your `.bash_profile` or `.zshrc` file.
- Create an alias by adding the command `alias ws-connector-console=/Applications/ws-connector-console.app/Contents/MacOS/ws-connector-console` to your `.bash_profile` or `.zshrc` file.

###
### Linux (Ubuntu)
On Ubuntu you can simply install the downloaded .deb package with the following command:
```sh
sudo dpkg -i ws-connector-console-linux-arm64-0.0.1.deb
```
The app is then ready to be used from the command line.

###
### Windows
The installation process for Windows consists of two steps:
1. Get a real operating system.
2. Follow the instructions above for either Linux or MacOS.

##
## Usage

The console can be started either in server mode or in client mode.

### Server mode
You can start the ws-connector console in server mode using the following command:
```sh
ws-connector-console -s PORT PATH
```
Where `PORT` is an integer and `PATH` is a string like `/ws`.

For example, a server console started with the command `ws-connector-console -s 3000 /ws` will accept connections on `ws://localhost:3000/ws`.

###
### Client mode
You can start the ws-connector console in client mode using the following command:
```sh
ws-connector-console -c URL
```
Where `URL` is the websocket URL, for example `ws://localhost:3000/ws`.