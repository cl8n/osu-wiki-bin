import { Command } from 'commander';
import { errorX, warning, warningX } from '../console.js';
import { groupMembers } from '../web.js';
import { groupMap, loadGroup } from '../wiki.js';

interface CheckGroupsOptions {
	group?: string[];
}

interface User {
	bot?: true;
	country: string;
	id: number;
	name: string;
	playmodes: string[];
	probation: boolean;
}

const groups = [
	{
		directory: 'Beatmap_Nominators',
		optionRegex: /bng?|nominator/i,
	},
	{
		directory: 'Developers',
		optionRegex: /dev/i,
	},
	{
		directory: 'Global_Moderation_Team',
		optionRegex: /gmt|mod/i,
	},
	{
		directory: 'Nomination_Assessment_Team',
		optionRegex: /nat|nomination assess/i,
	},
	{
		directory: 'osu!_Alumni',
		optionRegex: /alu|alm/i,
	},
	{
		directory: 'Technical_Support_Team',
		optionRegex: /sup/i,
	},
] as const;

const playmodeShortNames = ['osu', 'taiko', 'fruits', 'mania'];
const playmodeLongNames = ['osu!', 'osu!taiko', 'osu!catch', 'osu!mania'];

export async function checkGroups(options: CheckGroupsOptions) {
	const groupsToCheck = groups
		.filter((group) => options.group?.some((g) => group.optionRegex.test(g)) ?? true)
		.map((group) => ({ ...group, content: loadGroup(group.directory) }));

	for (const group of groupsToCheck) {
		if (group.directory === 'Developers') {
			// Remove the "Contributors" section of the "Developers" article, because
			// the users listed there are intentionally not included in the online group
			group.content =
				group.content.slice(0, group.content.lastIndexOf('### Contributors')) +
				group.content.slice(group.content.lastIndexOf('## Retired contributors'));
		}
		
		if (group.directory === 'Nomination_Assessment_Team') {
			// Remove the "Departure from the NAT" section of the "Nomination_Assessment_Team"
			// article, because the users listed there are former members
			group.content =
				group.content.slice(0, group.content.lastIndexOf('## Departure from the NAT')) +
				group.content.slice(group.content.lastIndexOf('## NAT Leadership'));
		}

		const onlineUsers: User[] = [];
		for (const groupId of groupMap[group.directory]) {
			// Each user has
			// .id, .country.code, .is_bot, .username, .groups.[].(id, is_probationary, playmodes)
			// TODO: actually type this
			for (const user of await groupMembers(groupId)) {
				if (user.is_bot) {
					onlineUsers.push({
						bot: true,
						country: user.country.code,
						id: user.id,
						name: user.username,
						playmodes: [],
						probation: false,
					});
					continue;
				}

				const userGroup = user.groups.find((userGroup: any) => userGroup.id === groupId);

				if (userGroup == null) {
					warning(`Ignoring online user "${user.username}" (#${user.id}) in group #${groupId}; missing usergroup info`);
					continue;
				}

				onlineUsers.push({
					country: user.country.code,
					id: user.id,
					name: user.username,
					playmodes: userGroup.playmodes || [],
					probation: userGroup.is_probationary,
				});
			}
		}

		const articleHasPlaymodes =
			group.directory === 'Beatmap_Nominators' || group.directory === 'Nomination_Assessment_Team';
		const articleHasProbation =
			group.directory === 'Beatmap_Nominators';

		const playmodeHeadersReverse = [...group.content.matchAll(/^#{3,4} (osu!(?:taiko|catch|mania)?)/gm)]
			.map((match) => ({
				index: match.index!,
				playmode: playmodeShortNames[playmodeLongNames.indexOf(match[1])],
			}))
			.reverse();
		const probationaryHeaderIndex = group.content.lastIndexOf('### Probationary');
		const userRegex =
			/^(?:-|\|) ::{ flag=([A-Z]{2}) }:: \[(.+?)\]\(https:\/\/osu\.ppy\.sh\/users\/(\d+)\)(?:$| \|)/gm;

		const localUsers: User[] = [];
		for (const userMatch of group.content.matchAll(userRegex)) {
			const playmodes = [];

			if (articleHasPlaymodes) {
				const header = playmodeHeadersReverse.find((header) => header.index < userMatch.index!);

				if (header != null) {
					playmodes.push(header.playmode);
				}
			}

			localUsers.push({
				country: userMatch[1],
				id: parseInt(userMatch[3], 10),
				name: userMatch[2].replaceAll('\\', ''),
				playmodes,
				probation: articleHasProbation && userMatch.index! > probationaryHeaderIndex,
			});
		}

		const skipLocalUserIds = new Set<number>();
		const skipLocalUserIdsOfProbation = new Set<string>();

		// Check that each local user corresponds to an online user
		for (const localUser of localUsers) {
			if (
				skipLocalUserIds.has(localUser.id) ||
				skipLocalUserIdsOfProbation.has(`${localUser.id}-${localUser.probation ? 'p' : 'f'}`)
			) {
				continue;
			}

			let users = onlineUsers.filter((user) => user.id === localUser.id);

			if (users.length === 0) {
				errorX(`${group.directory}: User "${localUser.name}" (#${localUser.id}) is not a member of the online group`);
				skipLocalUserIds.add(localUser.id);
				continue;
			}

			users = users.filter((user) => user.probation === localUser.probation);

			if (users.length === 0) {
				errorX(`${group.directory}: User "${localUser.name}" (#${localUser.id}) is not a member of the ${localUser.probation ? '' : 'non-'}probationary online group`);
				skipLocalUserIdsOfProbation.add(`${localUser.id}-${localUser.probation ? 'p' : 'f'}`);
				continue;
			}

			const onlinePlaymodes = users.reduce<string[]>((playmodes, user) => [...playmodes, ...user.playmodes], []);
			const missingOnlinePlaymodes = localUser.playmodes.filter((playmode) => !onlinePlaymodes.includes(playmode));

			if (missingOnlinePlaymodes.length > 0) {
				for (const playmode of missingOnlinePlaymodes) {
					errorX(`${group.directory}: User "${localUser.name}" (#${localUser.id}) does not have playmode ${playmodeLongNames[playmodeShortNames.indexOf(playmode)]} in the ${localUser.probation ? 'probationary ' : ''}online group`);
				}

				continue;
			}

			// This is a correct listing, so now let's make sure the country flag and username are correct
			if (localUser.country !== users[0].country) {
				warningX(`${group.directory}: User "${localUser.name}" (#${localUser.id}) has wrong country flag (found ${localUser.country}, expected ${users[0].country})`);
			}

			if (localUser.name !== users[0].name) {
				warningX(`${group.directory}: User "${localUser.name}" (#${localUser.id}) has wrong username (expected "${users[0].name}")`);
			}
		}

		const skipOnlineUserIds = new Set<number>();
		const skipOnlineUserIdsOfProbation = new Set<string>();

		// Check that each online user corresponds to a local user
		for (const onlineUser of onlineUsers) {
			if (
				skipOnlineUserIds.has(onlineUser.id) ||
				skipOnlineUserIdsOfProbation.has(`${onlineUser.id}-${onlineUser.probation ? 'p' : 'f'}`)
			) {
				continue;
			}

			let users = localUsers.filter((user) => user.id === onlineUser.id);

			if (users.length === 0) {
				if (!onlineUser.bot) {
					errorX(`${group.directory}: User "${onlineUser.name}" (#${onlineUser.id}) is missing in the article`);
				}

				skipOnlineUserIds.add(onlineUser.id);
				continue;
			}

			users = users.filter((user) => user.probation === onlineUser.probation);

			if (users.length === 0) {
				errorX(`${group.directory}: User "${onlineUser.name}" (#${onlineUser.id}) is missing from the ${onlineUser.probation ? '' : 'non-'}probationary section of the article`);
				skipOnlineUserIdsOfProbation.add(`${onlineUser.id}-${onlineUser.probation ? 'p' : 'f'}`);
				continue;
			}

			const localPlaymodes = users.reduce<string[]>((playmodes, user) => [...playmodes, ...user.playmodes], []);
			const missingLocalPlaymodes = onlineUser.playmodes.filter((playmode) => !localPlaymodes.includes(playmode));

			if (missingLocalPlaymodes.length > 0) {
				for (const playmode of missingLocalPlaymodes) {
					errorX(`${group.directory}: User "${onlineUser.name}" (#${onlineUser.id}) is missing playmode ${playmodeLongNames[playmodeShortNames.indexOf(playmode)]} in the ${articleHasProbation ? `${onlineUser.probation ? '' : 'non-'}probationary section of the ` : ``}article`);
				}
			}
		}
	}
}

export function checkGroupsCommandBuilder() {
	return new Command('check-groups')
		.description('Report differences between group article member lists and group member lists on web')
		.option('-g, --group <groups...>', 'Restrict to specific groups')
		.action(checkGroups);
}
