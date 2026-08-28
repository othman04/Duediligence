import os

def get_h3_index(latitude: float, longitude: float, resolution: int = 9) -> str:
    """
    MOCK H3: La compilation de la librairie C h3 échoue sur Windows sans Visual Studio.
    En attendant, on utilise un pseudo-index basé sur les coordonnées arrondies (approx 100m).
    """
    # Arrondir à 3 décimales donne une grille d'environ 111 mètres
    return f"pseudo_h3_{round(latitude, 3)}_{round(longitude, 3)}"
