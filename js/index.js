// TODO: rewrite with jquery
import { Octokit } from "https://cdn.skypack.dev/octokit";

const octokit = new Octokit();

// an object to maintain application state
// TODO: probably the whole application should be a class
// but who cares
const applicationState = {
	page: 1,
	perPage: 100, // this is bullshittous as github returns merged and non-merged PRs, also we skip changelogless PRs
	repo: 'TauCetiClassic',
	owner: 'TauCetiStation',
	changelogs: new Map(), // keys are PR numbers, values are what is returned by fetchPulls() 
	filterString: '', // used by search
};

const fetchPulls = async function fetchPulls() {
	try {
		const { headers, data } = await octokit.rest.pulls.list({
			owner: applicationState.owner,
			repo: applicationState.repo,
			page: applicationState.page,
			per_page: applicationState.perPage,
			state: 'closed', // no way to fetch only merged PRs
		});

		// next time we fetch another bunch of PRs
		// if this fetch fails, no increment
		applicationState.page++;

		// TODO: You are being rate limited
		console.log(headers);

		const allowed = [
			'html_url', 'number',    'state', 'title',
			'body',     'merged_at', 'user',
		];

		// union of Maps
		applicationState.changelogs = new Map([
			...applicationState.changelogs,
			// js bullshittery to strip garbage from object
			...data.map(o => Object.keys(o).filter(k => allowed.includes(k)).reduce((acc, k) => ({ ...acc, [k]: o[k] }), {}))
			       .filter(({ merged_at }) => merged_at !== null)
				   .map(({ user, merged_at, ...rest }) =>
						({
							author: user.login,
							merged_at: (new Date(merged_at)).toLocaleDateString(),
							...rest,
						})
					)
				   .map(o => ({ ...o, parsed: parseChangelogBody(o) }))
				   .filter(({ parsed }) => parsed !== null)
				   .map(o => [o.number, o]) // prepare to be consumed by Map constructor
		]);
	} catch (e) {
		// TODO: handle different answers from github...
		throw e;
	}
};

const parseChangelogBody = function parseChangelogBody({ body, author }) {
	if(!body)
		return null;
	
	// clear comments as the may contain :cl:
	body = body.replace(/(<!--.*?-->)|(<!--[\S\s]+?-->)|(<!--[\S\s]*?$)/g, "");

	let parts = body.match(/:cl:[\s\S]*/m);
	if(parts === null)
		return null;

	parts = parts[0].split(/[\r\n]+/).map(x => x.trim());

	// deleting :cl: might still have some spaces
	let authorship = parts[0].substring(4).trim();
	if(authorship.length === 0)
		// if no author is specified in :cl: it defaults to PR author
		authorship = author;

	const changelog = parts.slice(1)
						   .map(e => e.replace(/^-\s*/, "")) // remove the markdown list notation
	                       .filter(s => s.length > 0);
	if(changelog.length === 0)
		return null;

	return { authorship, changelog };
};

const renderChangelogEntry = function renderChangelogEntry({ parsed: { authorship, changelog } }) {
	const ul = document.createElement('ul');
	ul.classList.add("ui", "list")
	ul.append(...changelog.map(e => {
		const li = document.createElement('li');
		li.textContent = e;
		return li;
	}));

	const holder = document.createElement('div');
	holder.append(authorship);
	holder.append(ul);
	
	return holder;
}

const renderChangelog = async function renderChangelog() {
	// a fast way to clear a node
	const table = document.getElementById('changelogTable');
	table.textContent = '';
	Object.entries(
		[...applicationState.changelogs.values()]
			.filter(entry => {
				if(applicationState.filterString.length === 0)
					return true;
				return entry.author.search(applicationState.filterString) !== -1
				    || entry.title.search(applicationState.filterString) !== -1
					|| entry.parsed.authorship.search(applicationState.filterString) !== -1
					|| entry.parsed.changelog.join(" ").search(applicationState.filterString) !== -1;
			})
			.map(entry => {
				const link = document.createElement('a');
				link.href = entry.html_url;
				link.textContent = entry.number;

				const tdN = document.createElement('td');
				tdN.append(link);

				const tdBody = document.createElement('td');
				tdBody.append(renderChangelogEntry(entry));

				const tr = document.createElement('tr');
				tr.appendChild(tdN);
				tr.appendChild(tdBody);
				return {
					date: entry.merged_at,
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

const fetchAndRender = async function() {
	await fetchPulls();
	await renderChangelog();
}

// a debug form, delete me
// document.getElementById('testForm').addEventListener('submit', (ev) => {
// 	ev.preventDefault();
// 	applicationState.owner = document.getElementById('formOwner').value;
// 	applicationState.repo = document.getElementById('formRepo').value;
// 	applicationState.page = 1;
// 	fetchAndRender();
// });

document.getElementById('searchForm').addEventListener('submit', (ev) => {
	ev.preventDefault();
	applicationState.filterString = document.getElementById('searchQuery').value;
	renderChangelog();
});

document.addEventListener('scroll', (ev) => {
	if(window.scrollY + window.innerHeight + 100 > document.body.scrollHeight) {
		fetchAndRender();
	}
});

fetchAndRender();
