const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { AutoComplete } = require('enquirer');

export async function cli() {
	try {
		const netstat = await getNetstat();
		const devUrls = netstat.filter((line) => line.proto === 'tcp46');

		if (devUrls.length === 0) {
			console.log('lo: no dev urls found');
			return;
		}

		const choices = await Promise.all(
			devUrls.map(async (line) => {
				const port = line.local_address.split('.').pop();
				const url = `localhost:${port}`;
				const urlWithProtocol = `http://${url}`;
				const htmlTitle = await getPageTitle(urlWithProtocol);
				return {
					name: url,
					hint: htmlTitle,
					value: urlWithProtocol,
				};
			})
		);

		const prompt = new AutoComplete({
			name: 'port',
			message: 'Which dev server do you want to open?',
			choices,
		});

		const selectedDevUrl = await prompt.run();
		openInBrowser(selectedDevUrl);
	} catch (error) {
		console.log(error);
	}
}

async function getNetstat() {
	const { stdout, stderr } = await exec('netstat -anp tcp');
	if (stderr) {
		throw new Error(stderr);
	}

	// depending on the OS, the output of netstat will be different
	const arrayOrder = {
		linux: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid'],
		win32: ['proto', 'local_address', 'foreign_address', 'state', 'pid'],
		darwin: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid', 'process_name'],
		freebsd: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid', 'process_name'],
		openbsd: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid', 'process_name'],
		sunos: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid', 'process_name'],
		aix: ['proto', 'recvq', 'sendq', 'local_address', 'foreign_address', 'state', 'pid', 'process_name'],
	};

	return stdout
		.split('\n')
		.map((line) => {
			if (!line) return null;
			const array = line.split(/\s+/);
			const obj = {};
			arrayOrder[process.platform].forEach((key, index) => {
				obj[key] = array[index];
			});
			return obj;
		})
		.filter((line) => line);
}

async function getPageTitle(url) {
	// curl only first 100 bytes
	const { stdout, stderr } = await exec(`curl -s ${url} --max-time 1 --range 0-100  --compressed`);

	if (stderr) {
		throw new Error(stderr);
	}

	const match = stdout.match(/<title>(.*)<\/title>/);
	if (match) {
		return match[1];
	}
	return null;
}

function openInBrowser(url) {
	const { exec } = require('child_process');
	exec(`open ${url}`);
}
