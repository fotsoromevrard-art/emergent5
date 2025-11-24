from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import uuid
import json
from web3 import Web3
from decimal import Decimal

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Web3 Configuration for BSC Testnet
BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545"
BSC_TESTNET_CHAIN_ID = 97

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(BSC_TESTNET_RPC))

# Token Addresses (BSC Testnet)
TOKEN_ADDRESSES = {
    "XAF_STABLE": "0x3c96aBa8bA994Cb2452a9BcE362Efb0EDCDfaEee",
    "EUROM_STABLE": "0x531B876fc439F64Be5922551FE222aBf08B8D08E",
    "TND_STABLE": "0x6ae8193d14fb289E43AD1238aadEB1E537EdCa6B"
}

# Minimal ERC20 ABI
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]

# Create FastAPI app
app = FastAPI(title="TPE Crypto API")
api_router = APIRouter(prefix="/api")

# In-memory stores (use DB in production)
payment_requests = {}
transaction_status = {}

# Pydantic Models
class WalletConfigRequest(BaseModel):
    merchant_address: str = Field(..., description="Merchant wallet address")

class WalletConfigResponse(BaseModel):
    success: bool
    merchant_address: str
    message: str

class BalanceRequest(BaseModel):
    wallet_address: str
    token_symbol: Optional[str] = "all"

class TokenBalance(BaseModel):
    symbol: str
    name: str
    balance: str
    balance_formatted: str
    contract_address: str

class BalanceResponse(BaseModel):
    wallet_address: str
    bnb_balance: str
    tokens: List[TokenBalance]

class CreatePaymentRequest(BaseModel):
    amount: float
    currency: str
    recipient_address: str
    description: Optional[str] = None

class PaymentLinkResponse(BaseModel):
    payment_id: str
    amount: float
    currency: str
    recipient_address: str
    payment_link: str
    qr_data: str
    status: str
    created_at: str

class TransactionCreate(BaseModel):
    payment_id: str
    tx_hash: str
    from_address: str
    to_address: str
    amount: float
    currency: str
    payment_type: str

class TransactionResponse(BaseModel):
    id: str
    payment_id: Optional[str]
    tx_hash: str
    from_address: str
    to_address: str
    amount: float
    currency: str
    status: str
    payment_type: str
    created_at: str
    block_number: Optional[int] = None
    gas_used: Optional[int] = None

class RefundRequest(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    reason: str

# Helper Functions
def get_token_contract(token_symbol: str):
    """Get ERC20 contract instance"""
    address = TOKEN_ADDRESSES.get(token_symbol)
    if not address:
        return None
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=ERC20_ABI)

def get_token_balance(wallet_address: str, token_symbol: str) -> Dict:
    """Get token balance for wallet"""
    try:
        contract = get_token_contract(token_symbol)
        if not contract:
            return None
        
        wallet = Web3.to_checksum_address(wallet_address)
        balance_wei = contract.functions.balanceOf(wallet).call()
        decimals = contract.functions.decimals().call()
        symbol = contract.functions.symbol().call()
        name = contract.functions.name().call()
        
        balance_formatted = float(Decimal(balance_wei) / Decimal(10 ** decimals))
        
        return {
            "symbol": symbol,
            "name": name,
            "balance": str(balance_wei),
            "balance_formatted": str(balance_formatted),
            "contract_address": contract.address
        }
    except Exception as e:
        logger.error(f"Error getting balance for {token_symbol}: {str(e)}")
        return None

# API Routes
@api_router.get("/")
async def root():
    return {
        "message": "TPE Crypto API",
        "version": "1.0.0",
        "blockchain": "BSC Testnet",
        "status": "operational"
    }

@api_router.get("/blockchain/status")
async def blockchain_status():
    """Get blockchain connection status"""
    try:
        is_connected = w3.is_connected()
        latest_block = w3.eth.block_number if is_connected else 0
        gas_price = w3.eth.gas_price if is_connected else 0
        
        return {
            "connected": is_connected,
            "chain_id": BSC_TESTNET_CHAIN_ID,
            "latest_block": latest_block,
            "gas_price_gwei": float(w3.from_wei(gas_price, 'gwei')) if gas_price else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/wallet/configure", response_model=WalletConfigResponse)
async def configure_merchant_wallet(request: WalletConfigRequest):
    """Configure merchant wallet address"""
    try:
        # Validate address
        checksum_address = Web3.to_checksum_address(request.merchant_address)
        
        # Store in database
        await db.merchant_config.update_one(
            {"type": "merchant_wallet"},
            {"$set": {
                "address": checksum_address,
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        
        return WalletConfigResponse(
            success=True,
            merchant_address=checksum_address,
            message="Merchant wallet configured successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid address: {str(e)}")

@api_router.get("/wallet/merchant")
async def get_merchant_wallet():
    """Get configured merchant wallet"""
    config = await db.merchant_config.find_one({"type": "merchant_wallet"})
    if not config:
        raise HTTPException(status_code=404, detail="Merchant wallet not configured")
    return {"merchant_address": config["address"]}

@api_router.post("/balance", response_model=BalanceResponse)
async def get_balance(request: BalanceRequest):
    """Get wallet balance for all tokens"""
    try:
        wallet = Web3.to_checksum_address(request.wallet_address)
        
        # Get BNB balance
        bnb_balance_wei = w3.eth.get_balance(wallet)
        bnb_balance = w3.from_wei(bnb_balance_wei, 'ether')
        
        # Get token balances
        tokens = []
        for token_symbol in TOKEN_ADDRESSES.keys():
            balance_info = get_token_balance(request.wallet_address, token_symbol)
            if balance_info:
                tokens.append(TokenBalance(**balance_info))
        
        return BalanceResponse(
            wallet_address=wallet,
            bnb_balance=str(bnb_balance),
            tokens=tokens
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/payment/create-link", response_model=PaymentLinkResponse)
async def create_payment_link(request: CreatePaymentRequest):
    """Create payment link for crypto payment"""
    try:
        payment_id = str(uuid.uuid4())
        
        # Validate token
        if request.currency not in TOKEN_ADDRESSES:
            raise HTTPException(status_code=400, detail="Invalid currency")
        
        payment_data = {
            "payment_id": payment_id,
            "amount": request.amount,
            "currency": request.currency,
            "recipient": Web3.to_checksum_address(request.recipient_address),
            "description": request.description,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store in database
        await db.payment_requests.insert_one(payment_data)
        
        # Generate payment link
        payment_link = f"tpecrypto://pay/{payment_id}"
        
        # QR code data
        qr_data = json.dumps({
            "type": "payment",
            "payment_id": payment_id,
            "amount": request.amount,
            "currency": request.currency,
            "recipient": request.recipient_address,
            "contract": TOKEN_ADDRESSES[request.currency]
        })
        
        return PaymentLinkResponse(
            payment_id=payment_id,
            amount=request.amount,
            currency=request.currency,
            recipient_address=request.recipient_address,
            payment_link=payment_link,
            qr_data=qr_data,
            status="pending",
            created_at=payment_data["created_at"]
        )
    except Exception as e:
        logger.error(f"Error creating payment link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payment/{payment_id}")
async def get_payment_details(payment_id: str):
    """Get payment request details"""
    payment = await db.payment_requests.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    payment.pop("_id", None)
    return payment

@api_router.post("/transaction/create", response_model=TransactionResponse)
async def create_transaction(request: TransactionCreate):
    """Record a transaction"""
    try:
        tx_id = str(uuid.uuid4())
        
        tx_data = {
            "id": tx_id,
            "payment_id": request.payment_id,
            "tx_hash": request.tx_hash,
            "from_address": request.from_address,
            "to_address": request.to_address,
            "amount": request.amount,
            "currency": request.currency,
            "status": "pending",
            "payment_type": request.payment_type,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store in database
        await db.transactions.insert_one(tx_data)
        
        # Update payment status
        if request.payment_id:
            await db.payment_requests.update_one(
                {"payment_id": request.payment_id},
                {"$set": {"status": "processing", "tx_hash": request.tx_hash}}
            )
        
        return TransactionResponse(**tx_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/transaction/{tx_hash}")
async def get_transaction_status(tx_hash: str):
    """Get transaction status from blockchain"""
    try:
        # Check database first
        tx_record = await db.transactions.find_one({"tx_hash": tx_hash})
        
        # Check blockchain
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            status = "confirmed" if receipt['status'] == 1 else "failed"
            
            # Update database
            if tx_record:
                await db.transactions.update_one(
                    {"tx_hash": tx_hash},
                    {"$set": {
                        "status": status,
                        "block_number": receipt['blockNumber'],
                        "gas_used": receipt['gasUsed']
                    }}
                )
            
            return {
                "tx_hash": tx_hash,
                "status": status,
                "block_number": receipt['blockNumber'],
                "gas_used": receipt['gasUsed'],
                "from": receipt['from'],
                "to": receipt['to']
            }
        except Exception:
            return {
                "tx_hash": tx_hash,
                "status": "pending",
                "message": "Transaction not yet mined"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/transactions")
async def get_transactions(
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    currency: Optional[str] = None
):
    """Get transaction history"""
    query = {}
    if status:
        query["status"] = status
    if currency:
        query["currency"] = currency
    
    transactions = await db.transactions.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for tx in transactions:
        tx.pop("_id", None)
    
    return {"transactions": transactions, "count": len(transactions)}

@api_router.post("/refund/process")
async def process_refund(request: RefundRequest):
    """Process refund request"""
    try:
        # Get original transaction
        tx = await db.transactions.find_one({"id": request.transaction_id})
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Create refund record
        refund_id = str(uuid.uuid4())
        refund_amount = request.amount if request.amount else tx["amount"]
        
        refund_data = {
            "id": refund_id,
            "original_transaction_id": request.transaction_id,
            "amount": refund_amount,
            "currency": tx["currency"],
            "reason": request.reason,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db.refunds.insert_one(refund_data)
        
        return {
            "success": True,
            "refund_id": refund_id,
            "message": "Refund request created. Manual processing required."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tokens/supported")
async def get_supported_tokens():
    """Get list of supported tokens"""
    tokens = []
    for symbol, address in TOKEN_ADDRESSES.items():
        contract = get_token_contract(symbol)
        try:
            name = contract.functions.name().call()
            token_symbol = contract.functions.symbol().call()
            decimals = contract.functions.decimals().call()
            
            tokens.append({
                "symbol": token_symbol,
                "name": name,
                "key": symbol,
                "decimals": decimals,
                "contract_address": address
            })
        except:
            tokens.append({
                "symbol": symbol,
                "name": symbol,
                "key": symbol,
                "contract_address": address
            })
    
    return {"tokens": tokens, "network": "BSC Testnet"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)