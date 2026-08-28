"""
Decision Strategies for the Investment Decision Engine.
Implements the Strategy Pattern to apply different scoring weights, 
cash-flow rules, and explanations based on the property type.
"""
from abc import ABC, abstractmethod

class PropertyStrategy(ABC):
    @abstractmethod
    def evaluate(self, fin_score: float, loc_score: float, mkt_score: float, risk_score: float, monthly_cf: float, prob_loss: float) -> tuple[float, str, bool]:
        """
        Computes overall score, decision, and cash flow penalty.
        Returns: (overall_score, decision, cash_flow_penalty)
        """
        pass

    @abstractmethod
    def build_why_text(self, decision: str, overall_score: float, fin_report: dict, monthly_cf: float, 
                       cash_flow_penalty: bool, prob_loss: float, risk_score: float, 
                       score_result: dict, urban, collectivites) -> str:
        """
        Builds the explanation text tailored to the property type strategy.
        """
        pass


class ResidentialStrategy(PropertyStrategy):
    """
    Strategy for Appartement, Villa, Riad, Maison.
    Balanced focus on yield, location, and risk.
    """
    def evaluate(self, fin_score: float, loc_score: float, mkt_score: float, risk_score: float, monthly_cf: float, prob_loss: float) -> tuple[float, str, bool]:
        if risk_score >= 60:
            w_fin, w_loc, w_mkt, w_risk = 0.20, 0.15, 0.15, 0.50
        elif risk_score >= 30:
            w_fin, w_loc, w_mkt, w_risk = 0.30, 0.20, 0.20, 0.30
        else:
            w_fin, w_loc, w_mkt, w_risk = 0.35, 0.20, 0.25, 0.20

        overall_score = (
            (fin_score * w_fin) +
            (loc_score * w_loc) +
            (mkt_score * w_mkt) +
            ((100 - risk_score) * w_risk)
        )

        cash_flow_penalty = False
        if monthly_cf < -3000:
            cash_flow_penalty = True
            overall_score = min(overall_score, 55)

        if prob_loss > 30:
            overall_score = min(overall_score, 60)

        if overall_score >= 70 and risk_score < 40 and not cash_flow_penalty:
            decision = "ACHETER"
        elif overall_score >= 45:
            decision = "ÉTUDIER PLUS EN DÉTAIL"
        else:
            decision = "ÉVITER"
            
        return round(overall_score, 2), decision, cash_flow_penalty

    def build_why_text(self, decision: str, overall_score: float, fin_report: dict, monthly_cf: float, 
                       cash_flow_penalty: bool, prob_loss: float, risk_score: float, 
                       score_result: dict, urban, collectivites) -> str:
        
        gross_yield = fin_report["yield"]["gross_yield_pct"]
        net_yield = fin_report["yield"]["net_yield_pct"]
        aroi = fin_report["roi"]["annualized_roi_pct"]

        explanation = score_result.get("explanation", {})
        strengths = explanation.get("strengths", [])[:3]
        weaknesses = explanation.get("weaknesses", [])[:3]

        parts = []
        if decision == "ACHETER":
            parts.append(f"Excellente opportunité d'investissement résidentiel (score {round(overall_score, 1)}/100). Rendement brut de {gross_yield}% (net {net_yield}%), ROI annualisé de {aroi}% sur 10 ans.")
        elif decision == "ÉTUDIER PLUS EN DÉTAIL":
            parts.append(f"Potentiel résidentiel intéressant mais avec des réserves (score {round(overall_score, 1)}/100). Rendement brut de {gross_yield}%.")
        else:
            parts.append(f"Indicateurs défavorables (score {round(overall_score, 1)}/100). Rendement de {gross_yield}% insuffisant au vu des risques.")

        if monthly_cf > 0:
            parts.append(f"Cash flow positif de +{round(monthly_cf):,} MAD/mois après financement.")
        elif cash_flow_penalty:
            parts.append(f"⚠ Cash flow fortement négatif ({round(monthly_cf):,} MAD/mois) — effort d'épargne mensuel important.")
        elif monthly_cf < 0:
            parts.append(f"Cash flow de {round(monthly_cf):,} MAD/mois — effort modéré.")

        if prob_loss > 20:
            parts.append(f"⚠ Probabilité de perte à 10 ans : {round(prob_loss, 1)}%.")

        if strengths:
            parts.append("Points forts : " + " • ".join(strengths) + ".")
        if weaknesses:
            parts.append("Points d'attention : " + " • ".join(weaknesses) + ".")

        if urban and urban.zone_category:
            parts.append(f"Contexte urbanistique : zone {urban.zone_category}.")

        if collectivites and collectivites.nb_projets_urbains > 0:
            parts.append(f"Dynamique : {collectivites.nb_projets_urbains} projets urbains publics identifiés dans le quartier.")

        return " ".join(parts)


class CommercialStrategy(PropertyStrategy):
    """
    Strategy for Local commercial, Bureau.
    """
    def evaluate(self, fin_score: float, loc_score: float, mkt_score: float, risk_score: float, monthly_cf: float, prob_loss: float) -> tuple[float, str, bool]:
        w_fin, w_loc, w_mkt, w_risk = 0.45, 0.25, 0.15, 0.15
        
        if risk_score >= 60:
            w_fin, w_loc, w_mkt, w_risk = 0.30, 0.20, 0.10, 0.40

        overall_score = (
            (fin_score * w_fin) +
            (loc_score * w_loc) +
            (mkt_score * w_mkt) +
            ((100 - risk_score) * w_risk)
        )

        cash_flow_penalty = False
        if monthly_cf < 0:
            cash_flow_penalty = True
            overall_score = min(overall_score, 65) 

        if prob_loss > 25:
            overall_score = min(overall_score, 60)

        if overall_score >= 70 and not cash_flow_penalty:
            decision = "ACHETER"
        elif overall_score >= 50:
            decision = "ÉTUDIER PLUS EN DÉTAIL"
        else:
            decision = "ÉVITER"
            
        return round(overall_score, 2), decision, cash_flow_penalty

    def build_why_text(self, decision: str, overall_score: float, fin_report: dict, monthly_cf: float, 
                       cash_flow_penalty: bool, prob_loss: float, risk_score: float, 
                       score_result: dict, urban, collectivites) -> str:
        gross_yield = fin_report["yield"]["gross_yield_pct"]
        aroi = fin_report["roi"]["annualized_roi_pct"]
        
        parts = []
        if decision == "ACHETER":
            parts.append(f"Excellent investissement commercial (score {round(overall_score, 1)}/100). Forte rentabilité brute ({gross_yield}%) et ROI de {aroi}%.")
        elif decision == "ÉTUDIER PLUS EN DÉTAIL":
            parts.append(f"Rendement commercial à valider (score {round(overall_score, 1)}/100). Rentabilité de {gross_yield}%.")
        else:
            parts.append(f"Local inadapté ou trop cher (score {round(overall_score, 1)}/100).")

        if cash_flow_penalty:
            parts.append(f"⚠ Attention: Le cash flow commercial est négatif ({round(monthly_cf):,} MAD/mois), le loyer ne couvre pas la dette.")
        else:
            parts.append(f"Cash flow positif sécurisant (+{round(monthly_cf):,} MAD/mois).")

        explanation = score_result.get("explanation", {})
        strengths = explanation.get("strengths", [])[:3]
        if strengths:
            parts.append("Avantages : " + " • ".join(strengths) + ".")
            
        return " ".join(parts)


class LandStrategy(PropertyStrategy):
    """
    Strategy for Terrain, Ferme.
    """
    def evaluate(self, fin_score: float, loc_score: float, mkt_score: float, risk_score: float, monthly_cf: float, prob_loss: float) -> tuple[float, str, bool]:
        w_fin, w_loc, w_mkt, w_risk = 0.10, 0.35, 0.30, 0.25
        
        if risk_score >= 60:
            w_fin, w_loc, w_mkt, w_risk = 0.0, 0.20, 0.20, 0.60

        overall_score = (
            (fin_score * w_fin) +
            (loc_score * w_loc) +
            (mkt_score * w_mkt) +
            ((100 - risk_score) * w_risk)
        )

        cash_flow_penalty = False

        if overall_score >= 65 and risk_score < 50:
            decision = "ACHETER"
        elif overall_score >= 45:
            decision = "ÉTUDIER PLUS EN DÉTAIL"
        else:
            decision = "ÉVITER"
            
        return round(overall_score, 2), decision, cash_flow_penalty

    def build_why_text(self, decision: str, overall_score: float, fin_report: dict, monthly_cf: float, 
                       cash_flow_penalty: bool, prob_loss: float, risk_score: float, 
                       score_result: dict, urban, collectivites) -> str:
        
        parts = []
        if decision == "ACHETER":
            parts.append(f"Potentiel de valorisation foncière fort (score {round(overall_score, 1)}/100). Emplacement et marché favorables pour une plus-value.")
        elif decision == "ÉTUDIER PLUS EN DÉTAIL":
            parts.append(f"Foncier avec potentiel mais nécessitant une étude d'urbanisme approfondie (score {round(overall_score, 1)}/100).")
        else:
            parts.append(f"Risque de blocage ou d'enlisement élevé sur ce foncier (score {round(overall_score, 1)}/100).")

        if urban and urban.zone_category:
            parts.append(f"Zonage : {urban.zone_category}.")
        else:
            parts.append("⚠ Zonage inconnu, vérifiez auprès de l'Agence Urbaine.")

        if collectivites and collectivites.nb_lotissements > 0:
            parts.append(f"Dynamique : Le quartier montre de l'activité foncière avec {collectivites.nb_lotissements} lotissements et {collectivites.nb_projets_urbains} projets d'infrastructures publiques.")

        if risk_score >= 50:
            parts.append(f"⚠ Risque administratif ou environnemental modéré à élevé. (Score de risque: {risk_score}/100)")
            
        return " ".join(parts)


def get_strategy(type_bien: str) -> PropertyStrategy:
    type_bien_lower = type_bien.lower() if type_bien else ""
    
    if type_bien_lower in ["local commercial", "bureau", "magasin", "commercial"]:
        return CommercialStrategy()
    elif type_bien_lower in ["terrain", "ferme", "terrain industriel", "terrain agricole"]:
        return LandStrategy()
    else:
        return ResidentialStrategy()
