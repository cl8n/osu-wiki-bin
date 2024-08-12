import { Command } from 'commander';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error, warning } from '../console.js';
import { wikiPath } from '../wiki.js';

function countryNameFromTableRow(tableRow: string): string {
	return tableRow.match(/::\{ flag=[A-Z]{2} \}:: ([^|]+) \|/)![1];
}

function sortAttendanceRows(collator: Intl.Collator, table: string): string {
	const rows = table.split('\n');

	return (
		rows[0] + '\n' +
		rows[1] + '\n' +
		rows
			.slice(2, -2)
			.sort((a, b) => collator.compare(countryNameFromTableRow(a), countryNameFromTableRow(b)))
			.join('\n') +
		'\n' +
		rows[rows.length - 2] + '\n'
	);
}

function testContentValidity(content: string): boolean {
	const lines = content.split('\n');
	const headers = lines.filter((line) => /^###? .+/.test(line));

	return (
		headers.length === 11 &&
		headers.filter((line) => line.startsWith('### ![][osu!')).length === 8
	);
}

function translateCountryName(displayNames: Intl.DisplayNames, countryCode: string, enCountryName: string): string {
	const countryName = displayNames.of(countryCode) ?? enCountryName;

	switch (countryName) {
		// DE
		case 'Russland': return 'Russische Föderation';
		case 'Sonderverwaltungsregion Hongkong': return 'Hongkong';
		case 'Sonderverwaltungsregion Macau': return 'Macau';

		// ES
		case 'Chequia': return 'República Checa';
		case 'RAE de Hong Kong (China)': return 'Hong Kong';
		case 'RAE de Macao (China)': return 'Macao';
		case 'Rusia': return 'Federación de Rusia';

		// FR
		case 'R.A.S. chinoise de Hong Kong': return 'Hong Kong';
		case 'R.A.S. chinoise de Macao': return 'Macao';
		case 'Russie': return 'Fédération de Russie';
		case 'Tchéquie': return 'République tchèque';

		// ID
		case 'Ceko': return 'Republik Ceko';
		case 'Hong Kong DAK Tiongkok': return 'Hong Kong';
		case 'Inggris Raya': return 'Britania Raya';
		case 'Makau DAK Tiongkok': return 'Makau';

		// ZH
		case '中国香港特别行政区': return '香港';
		case '中国澳门特别行政区': return '澳门';
	}

	return countryName;
}

export async function translateTournamentCountries() {
	const articlePath = join(wikiPath, 'wiki/Tournaments/Countries_that_participated_in_osu!_tournaments');
	const enContent = await readFile(join(articlePath, 'en.md'), 'utf8');

	if (!testContentValidity(enContent)) {
		error('The structure of the EN article has changed since this command was last updated. Ask clayton to update it');
		return;
	}

	const enHeaderMatches = [...enContent.matchAll(/^###? .+/gm)];
	const enFirstDefinitionIndex = enContent.indexOf('[osu!]: ');

	for (const filename of await readdir(articlePath)) {
		if (filename === 'en.md') {
			continue;
		}

		const filenameMatch = filename.match(/^([a-z-]{2,5})\.md$/);

		if (filenameMatch == null) {
			continue;
		}

		const contentPath = join(articlePath, filename);
		const content = await readFile(contentPath, 'utf8');
		const locale = filenameMatch[1];

		if (!testContentValidity(content)) {
			warning(`The structure of the ${locale.toUpperCase()} article does not match EN, skipping`);
			continue;
		}

		const collator = new Intl.Collator(locale);
		const displayNames = new Intl.DisplayNames(locale, { type: 'region' });

		const headerMatches = [...content.matchAll(/^###? .+/gm)];
		const firstDefinitionIndex = content.indexOf('[osu!]: ');
		const firstTwoRankingTableCells = content.slice(headerMatches[1].index).match(/^\| [^|]+ \| [^|]+ \|/m)![0];
		const firstAttendanceTableCell = content.slice(headerMatches[7].index).match(/^\| [^|]+ \|/m)![0];
		const firstAttendanceTableCellOfLastRow = content
			.slice(headerMatches[7].index, headerMatches[8].index)
			.match(/^\| [^|]+ \|(?=.+\n\n)/m)![0];

		const newRankingTables = [1, 2, 3, 4, 5].map((headerIndex) => (
			enContent
				// Select the EN content between this and the next header
				.slice(
					enHeaderMatches[headerIndex].index! + enHeaderMatches[headerIndex][0].length,
					enHeaderMatches[headerIndex + 1].index!,
				)
				// Translate the first two cells of the contained table
				.replace(/^\| [^|]+ \| [^|]+ \|/m, firstTwoRankingTableCells)
				// Translate the country names in the contained table
				.replaceAll(/(?<=^\| \d+ \| ::\{ flag=([A-Z]{2}) \}:: )[^|]+(?= \|)/gm, (countryName, countryCode) => (
					translateCountryName(displayNames, countryCode, countryName)
				))
		));

		const newAttendanceTables = [7, 8, 9, 10].map((headerIndex) => (
			enContent
				// Select the EN content between this and the next header
				.slice(
					enHeaderMatches[headerIndex].index! + enHeaderMatches[headerIndex][0].length,
					enHeaderMatches[headerIndex + 1]?.index ?? enFirstDefinitionIndex,
				)
				// Translate the first cell of the contained table
				.replace(/^\| [^|]+ \|/m, firstAttendanceTableCell)
				// Translate the country names in the contained table
				.replaceAll(/(?<=^\| ::\{ flag=([A-Z]{2}) \}:: )[^|]+(?= \|)/gm, (countryName, countryCode) => (
					translateCountryName(displayNames, countryCode, countryName)
				))
				// Translate the first cell of the last row of the contained table
				.replace(/^\| [^|]+ \|(?=.+\n\n)/m, firstAttendanceTableCellOfLastRow)
				// Alphabetize table rows by country name
				.replace(/(?:\| .+\n)+/, (table) => sortAttendanceRows(collator, table))
		));

		let newContent = content.slice(0, headerMatches[1].index);

		for (let i = 0; i < newRankingTables.length; i++) {
			newContent += content.slice(headerMatches[1 + i].index, headerMatches[1 + i].index! + headerMatches[1 + i][0].length);
			newContent += newRankingTables[i];
		}

		newContent += content.slice(headerMatches[6].index, headerMatches[7].index);

		for (let i = 0; i < newAttendanceTables.length; i++) {
			newContent += content.slice(headerMatches[7 + i].index, headerMatches[7 + i].index! + headerMatches[7 + i][0].length);
			newContent += newAttendanceTables[i];
		}

		newContent += content.slice(firstDefinitionIndex);

		await writeFile(contentPath, newContent);
	}
}

export function translateTournamentCountriesCommandBuilder() {
	return new Command('translate-tournament-countries')
		.description('Update translations of "Countries that participated in osu! tournaments"')
		.action(translateTournamentCountries);
}
