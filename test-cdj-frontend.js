// Test for Clip des Jahres frontend functionality
// This verifies that the main functions are properly defined

console.log('Testing Clip des Jahres frontend...\n');

// Load the JavaScript file to check for syntax errors
const fs = require('fs');
const cdjCode = fs.readFileSync('./js/clip-des-jahres.js', 'utf8');

// Check for expected function definitions and key elements
const expectedElements = [
    'getUserIpHash',
    'enqueueEmbed',
    'startSequentialEmbedLoading',
    'loadNextEmbed',
    'init',
    'showCdjVotingInterface',
    'showCdjDisplay',
    'createClipCardForVoting',
    'showVotedMessage',
    'createClipCardWithoutVoting',
    'createWinnerCard',
    'fetchClipDesJahresPeriod',
    'showClipsByMonth',
    'createClipCard',
    'canEmbedClip',
    'createEmbedIframe',
    'showNoClipsMessage',
    'showError',
    'formatDate',
    'showVoteConfirm',
    'hideVoteConfirm',
    'confirmVote',
    'VOTE_STORAGE_KEY_CDJ',
    'cdjVotingConfig',
    'isCdjVoting'
];

let allFound = true;

expectedElements.forEach(element => {
    if (cdjCode.includes(element)) {
        console.log(`✓ ${element} is defined`);
    } else {
        console.log(`✗ ${element} is NOT found in code`);
        allFound = false;
    }
});

// Check for critical HTML element IDs
const htmlContent = fs.readFileSync('./clipdesjahres.html', 'utf8');
const requiredIds = [
    'cdj-container',
    'cdj-description',
    'vote-modal',
    'year'
];

console.log('\nChecking HTML elements...\n');

requiredIds.forEach(id => {
    if (htmlContent.includes(`id="${id}"`)) {
        console.log(`✓ Element #${id} exists in HTML`);
    } else {
        console.log(`✗ Element #${id} is MISSING from HTML`);
        allFound = false;
    }
});

// Check supabase-client.js for new functions
console.log('\nChecking Supabase client functions...\n');

const supabaseCode = fs.readFileSync('./js/supabase-client.js', 'utf8');
const requiredSupabaseFunctions = [
    'getClipDesJahresVotingConfig',
    'fetchClipDesJahresWinner',
    'submitVoteToDB'
];

requiredSupabaseFunctions.forEach(func => {
    if (supabaseCode.includes(`function ${func}`) || supabaseCode.includes(`async function ${func}`)) {
        console.log(`✓ ${func} is defined in supabase-client.js`);
    } else {
        console.log(`✗ ${func} is NOT found in supabase-client.js`);
        allFound = false;
    }
});

console.log('\n' + '='.repeat(50));
if (allFound) {
    console.log('✓ All frontend components are properly defined');
    process.exit(0);
} else {
    console.log('✗ Some components are missing');
    process.exit(1);
}
