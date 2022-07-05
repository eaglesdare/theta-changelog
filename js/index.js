// TODO: rewrite with jquery
import { Octokit } from "https://cdn.skypack.dev/octokit";

const octokit = new Octokit();

const applicationState = {
	page: 1,
	perPage: 100, // this is bullshittous as github returns merged and non-merged PRs, also we skip changelogless PRs
	repo: 'TauCetiClassic',
	owner: 'TauCetiStation',
};

const fetchPulls = async function fetchPulls() {
	try {
		const { headers, data } = await octokit.rest.pulls.list({
			owner: applicationState.owner,
			repo: applicationState.repo,
			page: applicationState.page,
			per_page: applicationState.perPage,
			state: 'closed', // TODO: list only merged PRs
		});

		// TODO: You are being rate limited
		console.log(headers);

		const allowed = [
			'html_url', 'number',    'state', 'title',
			'body',     'merged_at', 'user',
		];

		// js bullshittery to strip garbage from object
		return data.map(o => Object.keys(o).filter(k => allowed.includes(k)).reduce((acc, k) => ({ ...acc, [k]: o[k] }), {}))
			       .filter(({ merged_at }) => merged_at != null);
	} catch (e) {
		// TODO: handle different answers from github...
		throw e;
	}
};

const parseChangelogBody = function parseChangelogBody(body, fallbackAuthor) {
	if(!body)
		return null;
	body = body.replace(/(<!--.*?-->)|(<!--[\S\s]+?-->)|(<!--[\S\s]*?$)/g, "");
	let parts = body.match(/:cl:[\s\S]*/m);
	if(parts === null)
		return null;
	parts = parts[0].split(/[\r\n]+/).map(x => x.trim());
	// deleting :cl: might still have some spaces
	let authorship = parts[0].substring(4).trim();
	if(authorship.length === 0)
		authorship = fallbackAuthor
	const changelog = parts.slice(1).filter(s => s.length > 0);
	if(changelog.length === 0)
		return null;

	const ul = document.createElement('ul');
	ul.classList.add("ui", "list")
	ul.append(...changelog.map(e => {
		const li = document.createElement('li');
		li.textContent = e.substring(2);
		return li;
	}));

	const holder = document.createElement('div');
	holder.append(authorship);
	holder.append(ul);
	
	return holder;
};

const renderChangelog = async function renderChangelog() {
	const table = document.getElementById('changelogTable');
	
	// a fast way to clear a node

	const data = await fetchPulls();
	table.textContent = '';
	Object.entries(data.map(({ body, ...rest }) => ({ body: parseChangelogBody(body, rest.user.login), ...rest }))
		.filter(({ body }) => body !== null)
	    .map(entry => {

		const link = document.createElement('a');
		link.href = entry.html_url;
		link.textContent = entry.number;

		const tdN = document.createElement('td');
		tdN.append(link);

		const tdBody = document.createElement('td');
		tdBody.append(entry.body);

		const tr = document.createElement('tr');
		tr.appendChild(tdN);
		tr.appendChild(tdBody);
		return {
			date: (new Date(entry.merged_at)).toLocaleDateString(),
			element: tr,
		};
		})
		.reduce((group, what) => {
			const { date } = what;
			group[date] = group[date] ?? [];
			group[date].push(what);
			return group;
		}, {}))
			.forEach(([date, elements]) => {
				const td = document.createElement('td');
				td.innerHTML = `<h3 class="ui header">${ date }</h3>`;
				td.colSpan = 2;
				const tr = document.createElement('tr');
				tr.appendChild(td);
				table.appendChild(tr);
				elements.forEach(({ element }) => table.appendChild(element));
			});
};

renderChangelog();

document.getElementById('testForm').addEventListener('submit', (ev) => {
	ev.preventDefault();
	applicationState.owner = document.getElementById('formOwner').value;
	applicationState.repo = document.getElementById('formRepo').value;
	renderChangelog();
});
