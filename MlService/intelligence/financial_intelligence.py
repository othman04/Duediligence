"""
Financial Intelligence Module

Implements AI-03.1 to AI-03.9 features for Due Diligence Immobilière.
Provides a comprehensive financial model for real estate investments.
"""
import numpy as np

class FinancialIntelligenceModel:
    def __init__(self, sale_price: float, rental_price_monthly: float, params: dict = None, random_state: int = 42):
        """
        AI-03.1, AI-03.2, AI-03.3
        Initialize with predicted sale price and rental price.
        random_state makes Monte Carlo reproducible (tests + API).
        """
        sale_price = float(sale_price)
        rental_price_monthly = float(rental_price_monthly)
        if sale_price <= 0:
            raise ValueError("sale_price must be > 0")
        if rental_price_monthly < 0:
            raise ValueError("rental_price_monthly must be >= 0")
        self.sale_price = sale_price
        self.rental_price_monthly = rental_price_monthly
        self.annual_rent = self.rental_price_monthly * 12
        self.random_state = random_state
        
        # Default Moroccan financial parameters (AI-03.3)
        self.params = {
            "down_payment_pct": 0.20,       # Apport personnel (20%)
            "interest_rate": 0.045,         # Taux de crédit immobilier (4.5%)
            "loan_duration_years": 20,      # Durée du prêt (20 ans)
            "notary_fees_pct": 0.07,        # Frais de notaire (~7%)
            "maintenance_pct": 0.01,        # Entretien annuel (1% de la valeur)
            "property_tax_pct": 0.01,       # Taxe foncière (1%)
            "vacancy_rate": 0.05,           # Vacance locative (5%)
            "insurance_annual": 3000.0,     # Assurance habitation (MAD/an)
            "management_fees_pct": 0.05,    # Frais de gestion locative (5% des loyers)
            "appreciation_rate": 0.03,      # Plus-value annuelle (3%)
            "rent_growth_rate": 0.02,       # Augmentation annuelle du loyer (2%)
            "holding_period_years": 10      # Période de détention par défaut
        }
        
        if params:
            self.params.update(params)

    def _remaining_loan(self, loan_amount: float, monthly_rate: float, num_payments: int, payments_made: int) -> float:
        if payments_made >= num_payments or loan_amount <= 0:
            return 0.0
        if monthly_rate <= 0:
            paid = (loan_amount / num_payments) * payments_made
            return max(0.0, loan_amount - paid)
        factor_n = (1 + monthly_rate) ** num_payments
        factor_k = (1 + monthly_rate) ** payments_made
        return float(loan_amount * (factor_n - factor_k) / (factor_n - 1))

    def calculate_rental_yield(self) -> dict:
        """AI-03.4: Calculer Rental Yield (Rendement locatif brut et net)."""
        p = self.params
        
        total_acquisition_cost = self.sale_price * (1 + p["notary_fees_pct"])
        
        gross_yield = (self.annual_rent / total_acquisition_cost) * 100
        
        # Net rent = rent - vacancy - management - maintenance - taxes - insurance
        annual_vacancy_cost = self.annual_rent * p["vacancy_rate"]
        annual_management_cost = self.annual_rent * p["management_fees_pct"]
        annual_maintenance = self.sale_price * p["maintenance_pct"]
        annual_taxes = self.sale_price * p["property_tax_pct"]
        
        net_operating_income = self.annual_rent - (
            annual_vacancy_cost + annual_management_cost + 
            annual_maintenance + annual_taxes + p["insurance_annual"]
        )
        
        net_yield = (net_operating_income / total_acquisition_cost) * 100
        
        return {
            "gross_yield_pct": round(gross_yield, 2),
            "net_yield_pct": round(net_yield, 2),
            "net_operating_income": round(net_operating_income, 2)
        }

    def calculate_financing_and_cashflow(self) -> dict:
        """AI-03.6: Calculer Cash Flow."""
        p = self.params
        
        total_acquisition_cost = self.sale_price * (1 + p["notary_fees_pct"])
        down_payment_amount = total_acquisition_cost * p["down_payment_pct"]
        loan_amount = total_acquisition_cost - down_payment_amount
        
        # Monthly mortgage payment formula (amortization)
        monthly_rate = p["interest_rate"] / 12
        num_payments = p["loan_duration_years"] * 12
        
        if monthly_rate > 0:
            monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
        else:
            monthly_payment = loan_amount / num_payments
            
        annual_mortgage_payment = monthly_payment * 12
        
        # Get Net Operating Income (NOI)
        noi = self.calculate_rental_yield()["net_operating_income"]
        
        annual_cash_flow = noi - annual_mortgage_payment
        monthly_cash_flow = annual_cash_flow / 12
        
        return {
            "total_acquisition_cost": round(total_acquisition_cost, 2),
            "down_payment_amount": round(down_payment_amount, 2),
            "loan_amount": round(loan_amount, 2),
            "monthly_mortgage_payment": round(monthly_payment, 2),
            "annual_mortgage_payment": round(annual_mortgage_payment, 2),
            "annual_cash_flow": round(annual_cash_flow, 2),
            "monthly_cash_flow": round(monthly_cash_flow, 2)
        }

    def calculate_roi(self) -> dict:
        """AI-03.5 & AI-03.6: Calculer ROI / Net ROI & Capital Gain."""
        p = self.params
        fin = self.calculate_financing_and_cashflow()
        
        holding_years = p["holding_period_years"]
        
        # Cash flow accumulation over holding period (with rent growth and inflation)
        total_cash_flow = 0
        current_rent = self.annual_rent
        current_expenses = (
            current_rent * p["vacancy_rate"] + 
            current_rent * p["management_fees_pct"] +
            self.sale_price * p["maintenance_pct"] +
            self.sale_price * p["property_tax_pct"] +
            p["insurance_annual"]
        )
        
        for year in range(1, holding_years + 1):
            noi = current_rent - current_expenses
            cf = noi - fin["annual_mortgage_payment"]
            total_cash_flow += cf
            
            current_rent *= (1 + p["rent_growth_rate"])
            # Vacancy/management track rent; tax/maintenance/insurance track property value
            current_expenses = (
                current_rent * p["vacancy_rate"]
                + current_rent * p["management_fees_pct"]
                + self.sale_price * ((1 + p["appreciation_rate"]) ** year) * (
                    p["maintenance_pct"] + p["property_tax_pct"]
                )
                + p["insurance_annual"]
            )
            
        # Capital Gain
        future_sale_price = self.sale_price * ((1 + p["appreciation_rate"]) ** holding_years)
        capital_gain = future_sale_price - self.sale_price
        
        # Remaining loan balance after holding period
        monthly_rate = p["interest_rate"] / 12
        num_payments = p["loan_duration_years"] * 12
        payments_made = holding_years * 12
        
        remaining_loan = self._remaining_loan(
            fin["loan_amount"], monthly_rate, num_payments, payments_made
        )
            
        # Equity at sale
        equity_at_sale = future_sale_price - remaining_loan - (future_sale_price * 0.05) # 5% selling fees
        
        # Total Profit = Total Cash Flow + Equity at sale - Initial Down Payment
        total_profit = total_cash_flow + equity_at_sale - fin["down_payment_amount"]
        
        # ROI %
        roi_pct = (total_profit / fin["down_payment_amount"]) * 100 if fin["down_payment_amount"] > 0 else 0
        annualized_roi = ((1 + (roi_pct / 100)) ** (1 / holding_years) - 1) * 100 if roi_pct > -100 else -100
        
        return {
            "future_sale_price": round(future_sale_price, 2),
            "capital_gain": round(capital_gain, 2),
            "total_cash_flow_over_period": round(total_cash_flow, 2),
            "equity_at_sale": round(equity_at_sale, 2),
            "total_profit": round(total_profit, 2),
            "roi_pct": round(roi_pct, 2),
            "annualized_roi_pct": round(annualized_roi, 2)
        }

    def run_monte_carlo_simulation(self, iterations: int = 2000) -> dict:
        """
        AI-03.7 Monte Carlo: variation in appreciation, vacancy, rent growth.
        Seeded by self.random_state for reproducible API/tests.
        """
        p = self.params
        rng = np.random.default_rng(self.random_state)

        appreciation_rates = rng.normal(p["appreciation_rate"], 0.015, iterations)
        vacancy_rates = rng.triangular(0.01, p["vacancy_rate"], 0.15, iterations)
        rent_growth_rates = rng.normal(p["rent_growth_rate"], 0.01, iterations)
        
        # We will track Total Profit for each scenario
        profits = []
        
        # Static financial calculation parts
        fin = self.calculate_financing_and_cashflow()
        holding_years = p["holding_period_years"]
        
        for i in range(iterations):
            # Dynamic variables for this iteration
            sim_appreciation = appreciation_rates[i]
            sim_vacancy = vacancy_rates[i]
            sim_rent_growth = rent_growth_rates[i]
            
            # Cash flow simulation
            sim_total_cf = 0
            current_rent = self.annual_rent
            for year in range(1, holding_years + 1):
                expenses = (
                    current_rent * sim_vacancy + 
                    current_rent * p["management_fees_pct"] +
                    self.sale_price * p["maintenance_pct"] +
                    self.sale_price * p["property_tax_pct"] +
                    p["insurance_annual"]
                )
                noi = current_rent - expenses
                cf = noi - fin["annual_mortgage_payment"]
                sim_total_cf += cf
                current_rent *= (1 + sim_rent_growth)
                
            # Future sale simulation
            sim_future_price = self.sale_price * ((1 + sim_appreciation) ** holding_years)
            
            # Remaining loan is static since interest rate is fixed
            monthly_rate = p["interest_rate"] / 12
            num_payments = p["loan_duration_years"] * 12
            payments_made = holding_years * 12
            remaining_loan = self._remaining_loan(
                fin["loan_amount"], monthly_rate, num_payments, payments_made
            )
                
            sim_equity_at_sale = sim_future_price - remaining_loan - (sim_future_price * 0.05)
            
            sim_profit = sim_total_cf + sim_equity_at_sale - fin["down_payment_amount"]
            profits.append(sim_profit)
            
        return {
            "profits": np.array(profits),
            "down_payment": fin["down_payment_amount"]
        }

    def generate_scenarios(self) -> dict:
        """
        AI-03.8: Générer scénarios pessimiste / réaliste / optimiste
        Includes dispersion metrics for risk assessment.
        """
        sim_results = self.run_monte_carlo_simulation(iterations=2000)
        profits = sim_results["profits"]
        dp = sim_results["down_payment"]
        
        pessimistic_profit = np.percentile(profits, 10)
        realistic_profit = np.percentile(profits, 50)
        optimistic_profit = np.percentile(profits, 90)
        
        # Dispersion metrics — measures uncertainty of the investment
        std_dev = float(np.std(profits))
        coefficient_of_variation = (std_dev / abs(realistic_profit)) * 100 if realistic_profit != 0 else 100.0
        probability_of_loss = float(np.mean(profits < 0) * 100)
        
        def calc_roi(profit):
            return (profit / dp) * 100 if dp > 0 else 0
            
        return {
            "pessimistic": {
                "profit": round(pessimistic_profit, 2),
                "roi_pct": round(calc_roi(pessimistic_profit), 2)
            },
            "realistic": {
                "profit": round(realistic_profit, 2),
                "roi_pct": round(calc_roi(realistic_profit), 2)
            },
            "optimistic": {
                "profit": round(optimistic_profit, 2),
                "roi_pct": round(calc_roi(optimistic_profit), 2)
            },
            "dispersion": {
                "std_dev": round(std_dev, 2),
                "coefficient_of_variation_pct": round(coefficient_of_variation, 2),
                "probability_of_loss_pct": round(probability_of_loss, 2)
            }
        }

    @staticmethod
    def _linear_score(value: float, low: float, high: float, max_pts: float) -> float:
        """
        Continuous linear interpolation scoring.
        Returns 0 if value <= low, max_pts if value >= high,
        and linearly interpolates between.
        """
        if value <= low:
            return 0.0
        if value >= high:
            return max_pts
        return max_pts * (value - low) / (high - low)

    def calculate_financial_score(self, yield_data=None, roi_data=None, cf_data=None, scenarios=None) -> float:
        """
        AI-03.9: Générer Financial Score (0-100)
        Uses continuous linear interpolation instead of discrete tiers
        to preserve information granularity.
        Pass precomputed blocks to avoid a second Monte Carlo run.
        """
        yield_data = yield_data or self.calculate_rental_yield()
        roi_data = roi_data or self.calculate_roi()
        cf_data = cf_data or self.calculate_financing_and_cashflow()
        scenarios = scenarios or self.generate_scenarios()
        
        score = 0.0
        
        # 1. Gross Yield — continuous (max 25 pts)
        # 2% → 0 pts, 10% → 25 pts
        gy = yield_data["gross_yield_pct"]
        score += self._linear_score(gy, 2.0, 10.0, 25.0)
        
        # 2. Cash Flow — continuous with penalty (max 25 pts)
        # -5000 MAD/mois → 0 pts, +5000 → 25 pts
        mcf = cf_data["monthly_cash_flow"]
        score += self._linear_score(mcf, -5000, 5000, 25.0)
        
        # 3. Annualized ROI — continuous (max 30 pts)
        # 0% → 0 pts, 15% → 30 pts
        aroi = roi_data["annualized_roi_pct"]
        score += self._linear_score(aroi, 0.0, 15.0, 30.0)
        
        # 4. Monte Carlo Risk — penalize high dispersion (max 20 pts)
        # probability_of_loss 0% → 20 pts, 50% → 0 pts
        prob_loss = scenarios["dispersion"]["probability_of_loss_pct"]
        score += self._linear_score(50 - prob_loss, 0, 50, 20.0)
        
        return float(min(100, max(0, round(score, 1))))

    def generate_full_report(self) -> dict:
        """
        Returns all financial intelligence metrics in one dictionary.
        Monte Carlo runs once; the financial score reuses the same scenarios.
        """
        yield_data = self.calculate_rental_yield()
        financing = self.calculate_financing_and_cashflow()
        roi = self.calculate_roi()
        scenarios = self.generate_scenarios()
        score = self.calculate_financial_score(
            yield_data=yield_data, roi_data=roi, cf_data=financing, scenarios=scenarios
        )
        return {
            "sale_price": self.sale_price,
            "rental_price_monthly": self.rental_price_monthly,
            "parameters": self.params,
            "yield": yield_data,
            "financing_cashflow": financing,
            "roi": roi,
            "scenarios": scenarios,
            "financial_score": score,
        }

if __name__ == "__main__":
    # Test example
    # Apartment in Marrakech: 1,200,000 MAD to buy, rents for 7,500 MAD / month
    model = FinancialIntelligenceModel(sale_price=1200000, rental_price_monthly=7500)
    report = model.generate_full_report()
    
    import json
    print(json.dumps(report, indent=2, default=str))
