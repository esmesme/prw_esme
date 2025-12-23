import { getProvider } from "./app/web3/provider.js";
import { ethers } from "ethers";
import { MAINNET_RPC_ENDPOINTS, BASE_RPC_ENDPOINTS, CONTRACT_ADDRESS, ERC721_ABI } from "./app/lib/constants.js";
import { resolveENS } from "./app/web3/ens.js";

let provider;
let mainnetProvider;
let contract;
let tokens = [];

async function initializeProvider() {
    return await getProvider("base");
}

async function initializeMainnetProvider() {
    return await getProvider("mainnet");
}

document.addEventListener('DOMContentLoaded', async () => {
    const modal = document.getElementById('tokenModal');
    const closeBtn = document.querySelector('.close');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#token-')) {
            const tokenId = parseInt(hash.replace('#token-', ''));
            if (tokenId) {
                const token = tokens.find(t => t.tokenId === tokenId);
                if (token) {
                    openModal(token);
                } else {
                    closeModal();
                }
            }
        } else {
            closeModal();
        }
    });

    try {
        provider = await initializeProvider();
        contract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
        mainnetProvider = await initializeMainnetProvider();
        await loadTokens();
    } catch (error) {
        showError('Failed to connect to Base network. Please refresh the page.');
    }
});

async function loadTokens() {
    const loadingEl = document.getElementById('loading');
    const galleryEl = document.getElementById('gallery');

    try {
        loadingEl.textContent = 'Discovering works...';

        const MIN_TOKEN_ID = 1;
        const MAX_TOKEN_ID = 49;

        loadingEl.textContent = `Checking tokens ${MIN_TOKEN_ID}-${MAX_TOKEN_ID}...`;

        const tokenPromises = [];
        for (let tokenId = MIN_TOKEN_ID; tokenId <= MAX_TOKEN_ID; tokenId++) {
            tokenPromises.push(fetchTokenDataById(tokenId));
        }

        const BATCH_SIZE = 50;
        const allTokens = [];

        for (let i = 0; i < tokenPromises.length; i += BATCH_SIZE) {
            const batch = tokenPromises.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch);
            allTokens.push(...batchResults);

            const progress = Math.round(((i + BATCH_SIZE) / tokenPromises.length) * 100);
            loadingEl.textContent = `Checking tokens... ${Math.min(100, progress)}%`;
        }

        tokens = allTokens.filter(token => token !== null);

        if (tokens.length === 0) {
            loadingEl.textContent = 'No tokens found.';
            return;
        }

        tokens.sort((a, b) => a.tokenId - b.tokenId);

        loadingEl.textContent = `Loading ${tokens.length} works...`;

        displayTokens();

        loadingEl.style.display = 'none';
        galleryEl.style.opacity = '1';

        checkUrlForToken();
    } catch (error) {
        loadingEl.textContent = 'Error loading tokens. Please refresh the page.';
        showError('Failed to load tokens. Please check the console for details.');
    }
}

async function fetchTokenDataById(tokenId) {
    try {
        let tokenURI;
        try {
            tokenURI = await contract.tokenURI(tokenId);
        } catch (error) {
            return null;
        }

        if (!tokenURI || tokenURI === '') {
            return null;
        }

        const metadata = await fetchMetadata(tokenURI);
        if (!metadata) {
            return null;
        }

        let currentOwner = null;
        try {
            currentOwner = await contract.ownerOf(tokenId);
        } catch (error) {
        }

        return {
            tokenId: tokenId,
            currentOwner: currentOwner,
            ...metadata
        };
    } catch (error) {
        return null;
    }
}

async function getMinterAddress(tokenId) {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const MAX_BLOCK_RANGE = 10000;
    const MAX_SEARCH_BLOCKS = 500000;

    try {
        const currentBlock = await provider.getBlockNumber();
        const startBlock = Math.max(0, currentBlock - MAX_SEARCH_BLOCKS);
        const filter = contract.filters.Transfer(null, null, tokenId);
        let allEvents = [];
        let fromBlock = startBlock;
        let chunkCount = 0;
        const MAX_CHUNKS = 50;

        while (fromBlock <= currentBlock && chunkCount < MAX_CHUNKS) {
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);

            try {
                const events = await contract.queryFilter(filter, fromBlock, toBlock);
                if (events && events.length > 0) {
                    allEvents.push(...events);
                    break;
                }
            } catch (chunkError) {
            }

            fromBlock = toBlock + 1;
            chunkCount++;
        }

        if (allEvents.length > 0) {
            allEvents.sort((a, b) => a.blockNumber - b.blockNumber);

            const mintEvent = allEvents.find(e => {
                const from = e.args.from.toLowerCase();
                return from === zeroAddress.toLowerCase();
            });

            if (mintEvent) {
                return mintEvent.args.to;
            }

            return allEvents[0].args.to;
        }

        return null;
    } catch (error) {
        return null;
    }
}

async function fetchMetadata(uri) {
    try {
        if (uri.startsWith('ipfs://')) {
            uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        if (uri.startsWith('ar://')) {
            uri = uri.replace('ar://', 'https://arweave.net/');
        }

        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const metadata = await response.json();

        const normalized = {
            name: metadata.name || metadata.Name || '',
            description: metadata.description || metadata.Description || '',
            information: metadata.information || metadata.Information || '',
            image: metadata.image || metadata.image_url || metadata.imageUrl || '',
            attributes: metadata.attributes || metadata.Attributes || []
        };

        if (normalized.image) {
            if (normalized.image.startsWith('ipfs://')) {
                normalized.image = normalized.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            if (normalized.image.startsWith('ar://')) {
                normalized.image = normalized.image.replace('ar://', 'https://arweave.net/');
            }
        }

        return normalized;
    } catch (error) {
        return null;
    }
}

function displayTokens() {
    const galleryEl = document.getElementById('gallery');
    galleryEl.innerHTML = '';

    tokens.forEach(token => {
        const tokenElement = createTokenElement(token);
        galleryEl.appendChild(tokenElement);
    });
}

function createTokenElement(token) {
    const tokenDiv = document.createElement('div');
    tokenDiv.className = 'token-item';
    tokenDiv.addEventListener('click', () => openModal(token));

    const imageContainer = document.createElement('div');
    imageContainer.className = 'token-image-container';

    const img = document.createElement('img');
    img.className = 'token-image';
    img.src = token.image || '';
    img.alt = token.name || `Token #${token.tokenId}`;
    img.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f5f5f5" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="Helvetica" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
    };

    imageContainer.appendChild(img);

    const title = document.createElement('div');
    title.className = 'token-title';
    title.textContent = token.name || `Token #${token.tokenId}`;

    tokenDiv.appendChild(imageContainer);
    tokenDiv.appendChild(title);

    return tokenDiv;
}

async function openModal(token) {
    const modal = document.getElementById('tokenModal');
    const modalBody = document.getElementById('modalBody');

    window.history.pushState({ tokenId: token.tokenId }, '', `#token-${token.tokenId}`);

    modalBody.innerHTML = '';

    if (token.image) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'modal-image-container';
        const img = document.createElement('img');
        img.className = 'modal-image';
        img.src = token.image;
        img.alt = token.name || `Token #${token.tokenId}`;
        imageContainer.appendChild(img);
        modalBody.appendChild(imageContainer);
    }

    if (token.name) {
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = token.name;
        modalBody.appendChild(title);
    }

    if (token.description) {
        const description = document.createElement('p');
        description.className = 'modal-description';
        description.textContent = token.description;
        modalBody.appendChild(description);
    }

    if (token.information) {
        const information = document.createElement('p');
        information.className = 'modal-information';
        information.textContent = token.information;
        modalBody.appendChild(information);
    }

    if (token.attributes && token.attributes.length > 0) {
        const attributesSection = document.createElement('div');
        attributesSection.className = 'modal-attributes';

        const attributesTitle = document.createElement('h3');
        attributesTitle.textContent = 'Attributes';
        attributesSection.appendChild(attributesTitle);

        const attributesGrid = document.createElement('div');
        attributesGrid.className = 'attributes-grid';

        token.attributes.forEach(attr => {
            const attrItem = document.createElement('div');
            attrItem.className = 'attribute-item';

            const attrType = document.createElement('div');
            attrType.className = 'attribute-type';
            attrType.textContent = attr.trait_type || 'Attribute';

            const attrValue = document.createElement('div');
            attrValue.className = 'attribute-value';
            attrValue.textContent = attr.value || '';

            attrItem.appendChild(attrType);
            attrItem.appendChild(attrValue);
            attributesGrid.appendChild(attrItem);
        });

        attributesSection.appendChild(attributesGrid);
        modalBody.appendChild(attributesSection);
    }

    const infoSection = document.createElement('div');
    infoSection.className = 'modal-info-section';

    const minterDiv = document.createElement('div');
    minterDiv.className = 'modal-info-item';
    const minterLabel = document.createElement('span');
    minterLabel.className = 'modal-info-label';
    minterLabel.textContent = 'Minted by: ';
    const minterValue = document.createElement('span');
    minterValue.className = 'modal-info-value';
    minterValue.textContent = 'Loading...';
    minterDiv.appendChild(minterLabel);
    minterDiv.appendChild(minterValue);
    infoSection.appendChild(minterDiv);

    const ownerDiv = document.createElement('div');
    ownerDiv.className = 'modal-info-item';
    const ownerLabel = document.createElement('span');
    ownerLabel.className = 'modal-info-label';
    ownerLabel.textContent = 'Current Owner: ';
    const ownerValue = document.createElement('span');
    ownerValue.className = 'modal-info-value';

    if (token.currentOwner && token.currentOwner !== null && token.currentOwner !== '') {
        const ensName = await resolveENS(token.currentOwner);
        if (ensName) {
            ownerValue.textContent = `${ensName} (${token.currentOwner})`;
        } else {
            ownerValue.textContent = token.currentOwner;
        }
    } else {
        ownerValue.textContent = 'Not available';
    }

    ownerDiv.appendChild(ownerLabel);
    ownerDiv.appendChild(ownerValue);
    infoSection.appendChild(ownerDiv);

    const contractDiv = document.createElement('div');
    contractDiv.className = 'modal-info-item';
    const contractLabel = document.createElement('span');
    contractLabel.className = 'modal-info-label';
    contractLabel.textContent = 'Contract Tx Hash: ';
    const contractValue = document.createElement('span');
    contractValue.className = 'modal-info-value';
    contractValue.textContent = CONTRACT_ADDRESS;
    contractDiv.appendChild(contractLabel);
    contractDiv.appendChild(contractValue);
    infoSection.appendChild(contractDiv);

    const tokenIdDiv = document.createElement('div');
    tokenIdDiv.className = 'modal-info-item';
    const tokenIdLabel = document.createElement('span');
    tokenIdLabel.className = 'modal-info-label';
    tokenIdLabel.textContent = 'Token ID: ';
    const tokenIdValue = document.createElement('span');
    tokenIdValue.className = 'modal-info-value';
    tokenIdValue.textContent = token.tokenId;
    tokenIdDiv.appendChild(tokenIdLabel);
    tokenIdDiv.appendChild(tokenIdValue);
    infoSection.appendChild(tokenIdDiv);

    modalBody.appendChild(infoSection);

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    getMinterAddress(token.tokenId).then(async (minterAddress) => {
        if (minterAddress && modal.style.display === 'block') {
            const minterENS = await resolveENS(minterAddress);
            if (minterENS) {
                minterValue.textContent = `${minterENS} (${minterAddress})`;
            } else {
                minterValue.textContent = minterAddress;
            }
        } else if (modal.style.display === 'block') {
            minterValue.textContent = 'Not available';
        }
    }).catch(error => {
        if (modal.style.display === 'block') {
            minterValue.textContent = 'Not available';
        }
    });
}

function closeModal() {
    const modal = document.getElementById('tokenModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    if (window.location.hash) {
        window.history.pushState({}, '', window.location.pathname);
    }
}

function showError(message) {
    const loadingEl = document.getElementById('loading');
    loadingEl.textContent = message;
    loadingEl.style.color = '#d32f2f';
}

function checkUrlForToken() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#token-')) {
        const tokenId = parseInt(hash.replace('#token-', ''));
        if (tokenId) {
            const token = tokens.find(t => t.tokenId === tokenId);
            if (token) {
                openModal(token);
            }
        }
    }
}
