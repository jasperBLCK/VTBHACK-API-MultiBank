"""
Well-Known endpoints - JWKS
OpenID Connect Discovery compatible
"""
from fastapi import APIRouter
from pathlib import Path
import json

router = APIRouter(prefix="/.well-known", tags=["Technical: Well-Known"])


@router.get("/jwks.json", summary="Получить публичные ключи (JWKS)")
async def get_jwks():
    """
    JWKS endpoint - публичные ключи банка
    
    OpenID Connect Discovery
    RFC 7517 - JSON Web Key (JWK)
    
    Используется другими банками для проверки JWT подписей
    при межбанковских запросах.
    """
    from config import config
    
    # Путь к JWKS файлу банка
    jwks_path = Path(__file__).parent.parent.parent.parent / "shared" / "keys" / f"{config.BANK_CODE}_jwks.json"
    
    # Базовый JWKS если файла нет
    default_jwks = {
        "keys": [{
            "kid": f"{config.BANK_CODE}-2025",
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "n": "placeholder_modulus",
            "e": "AQAB"
        }]
    }
    
    # Загрузить из файла если есть
    if jwks_path.exists():
        try:
            with open(jwks_path, 'r') as f:
                return json.load(f)
        except:
            pass
    
    return default_jwks

