
import os
from dotenv import load_dotenv
from web3 import Web3
from web3.middleware import SignAndSendRawMiddlewareBuilder

load_dotenv()

RPC        = os.getenv("CHAIN_RPC", "https://rpc-amoy.polygon.technology")
CHAIN_ID   = int(os.getenv("CHAIN_ID", "80002"))
CONTRACT   = os.getenv("CONTRACT_ADDRESS")
PRIVATE_KEY= os.getenv("PRIVATE_KEY")
ENABLED    = os.getenv("CHAIN_ENABLE", "true").lower() == "true"

ABI = [{
    "type": "function",
    "name": "storeIncident",
    "stateMutability": "nonpayable",
    "inputs": [
        {"name": "_type", "type": "string"},
        {"name": "_hash", "type": "string"},
        {"name": "_tourist", "type": "string"}
    ],
    "outputs": []
}]

_w3 = None
_contract = None

def _client():
    global _w3, _contract
    if _w3 is not None:
        return _w3, _contract
    if not ENABLED:
        raise RuntimeError("CHAIN_ENABLE=false")
    if not (RPC and CONTRACT and PRIVATE_KEY):
        raise RuntimeError("Missing CHAIN_RPC/CONTRACT_ADDRESS/PRIVATE_KEY")
    _w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 20}))
    _w3.middleware_onion.add(SignAndSendRawMiddlewareBuilder.build(PRIVATE_KEY, chain_id=CHAIN_ID))
    _w3.eth.default_account = _w3.eth.account.from_key(PRIVATE_KEY).address
    _contract = _w3.eth.contract(address=Web3.to_checksum_address(CONTRACT), abi=ABI)
    return _w3, _contract

def anchor_incident(incident_type: str, hash_hex: str, tourist_id: str) -> str:
    if not ENABLED:
        return "CHAIN_DISABLED"
    w3, c = _client()
    tx_hash = c.functions.storeIncident(incident_type, hash_hex, tourist_id).transact({})
    return tx_hash.hex()
