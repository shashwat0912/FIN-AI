/**
 * Indian Finance Knowledge Base
 * Pre-populated knowledge chunks for RAG system
 */

export interface KnowledgeChunkData {
  content: string;
  category: string;
  source?: string;
  metadata?: Record<string, any>;
}

export const indianFinanceKnowledge: KnowledgeChunkData[] = [
  // BUDGETING
  {
    content: 'The 50/30/20 budget rule is highly effective for Indian households. Allocate 50% of post-tax income to needs (rent, utilities, groceries), 30% to wants (entertainment, dining out), and 20% to savings and debt repayment. This ensures balanced financial health while building wealth.',
    category: 'budgeting',
    source: 'Financial Planning Best Practices',
  },
  {
    content: 'Zero-based budgeting works well for Indian families with irregular income. Every rupee is assigned a purpose at the start of the month. Track expenses using UPI transaction history and adjust categories monthly. Popular apps like Money Manager or ET Money can automate this process.',
    category: 'budgeting',
    source: 'Personal Finance Guide India',
  },
  {
    content: 'Emergency fund should cover 6-12 months of expenses in India due to limited social security. Keep this in liquid instruments like savings bank accounts, liquid mutual funds, or fixed deposits with premature withdrawal facility. Aim for ₹3-6 lakhs for an average urban family.',
    category: 'budgeting',
    source: 'Emergency Planning Guidelines',
  },

  // INVESTMENTS
  {
    content: 'Equity Linked Savings Scheme (ELSS) offers dual benefits: tax deduction under Section 80C (up to ₹1.5 lakh) and potential for higher returns. Lock-in period is only 3 years, shortest among 80C options. Suitable for investors with 5+ year horizon and moderate risk tolerance.',
    category: 'investment',
    source: 'Income Tax Act Section 80C',
  },
  {
    content: 'Public Provident Fund (PPF) is a safe, government-backed savings scheme offering 7.1% interest (as of 2024) with EEE tax status. 15-year lock-in with partial withdrawal after 7 years. Maximum contribution ₹1.5 lakh per year. Ideal for long-term wealth creation and retirement planning.',
    category: 'investment',
    source: 'RBI PPF Guidelines',
  },
  {
    content: 'Systematic Investment Plans (SIPs) in index funds are cost-effective for wealth creation. Nifty 50 and Sensex index funds have expense ratios under 0.1%. Start with ₹5,000/month SIP and increase by 10% annually. Historical average returns: 12-14% over 15+ years.',
    category: 'investment',
    source: 'SEBI Investment Guidelines',
  },
  {
    content: 'National Pension System (NPS) offers tax benefits under Section 80CCD(1B) - additional ₹50,000 deduction over 80C limit. Low-cost retirement solution with equity exposure up to 75% before age 50. Mandatory annuity purchase reduces flexibility but ensures retirement income.',
    category: 'investment',
    source: 'PFRDA NPS Guidelines',
  },
  {
    content: 'Sovereign Gold Bonds (SGBs) issued by RBI offer better returns than physical gold: 2.5% annual interest + price appreciation. No making charges or storage issues. 8-year maturity with exit option after 5 years. Tax-free capital gains if held till maturity.',
    category: 'investment',
    source: 'RBI Sovereign Gold Bonds Scheme',
  },

  // TAX PLANNING
  {
    content: 'Section 80C allows ₹1.5 lakh deduction for EPF, PPF, ELSS, life insurance premium, principal repayment of home loan, tuition fees, and NSC. Section 80D allows ₹25,000 for health insurance (₹50,000 if senior citizen). Section 80CCD(1B) allows additional ₹50,000 for NPS contributions.',
    category: 'tax_planning',
    source: 'Income Tax Act 2024',
  },
  {
    content: 'New tax regime (from FY 2023-24) offers lower rates but removes most deductions. Old regime better if total deductions exceed ₹2.5 lakhs. Compare both regimes based on your investments. Standard deduction of ₹50,000 available in new regime.',
    category: 'tax_planning',
    source: 'Income Tax Rules 2023',
  },
  {
    content: 'Home loan interest deduction under Section 24(b) allows ₹2 lakh for self-occupied property. Section 80EEA offers additional ₹1.5 lakh for first-time buyers (property value up to ₹45 lakhs, loan up to ₹35 lakhs). Principal repayment covered under Section 80C.',
    category: 'tax_planning',
    source: 'Income Tax Act Section 24 & 80EEA',
  },

  // DEBT MANAGEMENT
  {
    content: 'Credit card debt in India typically carries 36-42% annual interest. Always pay full amount before due date. If carrying balance, consider balance transfer to card with lower rate or personal loan at 10-16%. Never pay minimum due - compounds quickly.',
    category: 'debt_management',
    source: 'RBI Credit Card Guidelines',
  },
  {
    content: 'Personal loan interest rates range from 10-24% based on credit score. CIBIL score above 750 gets best rates. Pre-payment penalties usually waived after 6-12 months. Use debt avalanche method: pay high-interest debts first while making minimum payments on others.',
    category: 'debt_management',
    source: 'Credit Management Best Practices',
  },
  {
    content: 'Home loan balance transfer can save lakhs if rate differential exceeds 0.5%. Factor in processing fees (usually 0.5-1% of loan amount) and legal charges. Many banks offer top-up loans at home loan rates, cheaper than personal loans for large expenses.',
    category: 'debt_management',
    source: 'Home Loan Guidelines',
  },

  // SAVINGS
  {
    content: 'Fixed Deposits (FDs) in India offer 6-8% interest depending on tenure. Senior citizens get additional 0.5% interest. Tax Deducted at Source (TDS) applicable if interest exceeds ₹40,000 per year (₹50,000 for senior citizens). Consider tax-saving FDs for Section 80C benefit.',
    category: 'savings',
    source: 'Bank Fixed Deposit Guidelines',
  },
  {
    content: 'Recurring Deposits (RDs) encourage disciplined savings with monthly installments from ₹100 to no upper limit. Interest rates similar to FDs. Premature withdrawal allowed with penalty. Good for building corpus for specific goals like vacation or down payment.',
    category: 'savings',
    source: 'Savings Account Guidelines',
  },
  {
    content: 'Debt mutual funds are tax-efficient for short-term savings (3 months to 3 years). Liquid funds offer better returns than savings accounts with T+1 day redemption. No TDS on gains, taxed as per your income tax slab if held less than 3 years.',
    category: 'savings',
    source: 'SEBI Mutual Fund Guidelines',
  },

  // RETIREMENT
  {
    content: 'Employee Provident Fund (EPF) is mandatory for salaried individuals. 12% of basic salary contribution with employer matching. Current interest rate: 8.25% (2023-24). Tax-free returns if withdrawn after 5 years of continuous service. Forms retirement corpus backbone.',
    category: 'retirement',
    source: 'EPFO Guidelines',
  },
  {
    content: 'Retirement corpus calculation: Multiply current monthly expenses by 12 and then by 25-30 (accounting for inflation). For example, ₹50,000 monthly expenses needs ₹1.5-1.8 crore corpus. Start SIP of ₹25,000/month to build ₹1 crore in 20 years at 12% returns.',
    category: 'retirement',
    source: 'Retirement Planning Calculator',
  },
  {
    content: 'Atal Pension Yojana (APY) guarantees pension of ₹1,000 to ₹5,000 per month after age 60. Government co-contribution available for eligible subscribers. Suitable for unorganized sector workers and self-employed. Contribution deductible under Section 80CCD.',
    category: 'retirement',
    source: 'PFRDA Atal Pension Yojana',
  },

  // INSURANCE
  {
    content: 'Term insurance is most cost-effective life cover. For ₹1 crore cover, 30-year-old pays ₹10,000-15,000 annual premium. Coverage should be 10-15x annual income. Avoid mixing insurance with investment - buy pure term insurance and invest separately.',
    category: 'insurance',
    source: 'IRDAI Insurance Guidelines',
  },
  {
    content: 'Health insurance is mandatory given rising medical costs. Family floater for ₹10-20 lakh covers parents and children. Senior citizen plans needed for parents above 60. Maternity benefit, pre-existing disease coverage, and cashless network are key factors to check.',
    category: 'insurance',
    source: 'Health Insurance Regulations',
  },

  // REAL ESTATE
  {
    content: 'Home loan EMI should not exceed 40% of monthly income for comfortable repayment. 20-year tenure is optimal balance - 15 years saves interest but increases EMI burden. Pre-payment reduces interest burden significantly. Focus on principal pre-payment, not EMI reduction.',
    category: 'real_estate',
    source: 'Home Loan Best Practices',
  },
  {
    content: 'Real estate as investment requires 20-30% down payment, generates 2-4% rental yield, and faces 8-12% property appreciation in tier-1 cities. Factor in 10-15% transaction costs (stamp duty, registration). Real Estate Investment Trusts (REITs) offer easier entry with ₹10,000-15,000.',
    category: 'real_estate',
    source: 'SEBI REIT Guidelines',
  },

  // CREDIT SCORE
  {
    content: 'CIBIL score ranges from 300-900. Score above 750 qualifies for best loan rates. Maintain credit utilization below 30%, pay bills on time, avoid multiple loan applications within short period. Check score free once a year at cibil.com. Errors can be disputed.',
    category: 'credit_score',
    source: 'CIBIL Score Guidelines',
  },
  {
    content: 'Building credit history: Start with credit card, use for small purchases, pay full amount monthly. Secured credit card available even without history. Takes 6-12 months to build initial score. Don\'t close old credit cards - length of credit history matters.',
    category: 'credit_score',
    source: 'Credit Bureau Guidelines',
  },

  // FINANCIAL GOALS
  {
    content: 'Child education in India costs ₹15-25 lakhs for 4-year degree, ₹50 lakhs+ for foreign education. Start SIP in equity mutual funds when child is young (15-18 year horizon). Sukanya Samriddhi Yojana for girl child offers 8% tax-free returns with 80C benefit.',
    category: 'goals',
    source: 'Education Planning Guide',
  },
  {
    content: 'Marriage expenses average ₹10-20 lakhs in urban India. Build corpus over 5-10 years using hybrid mutual funds or balanced advantage funds. Avoid personal loans for marriage - high interest burden. Consider simpler celebration and invest savings instead.',
    category: 'goals',
    source: 'Goal-Based Financial Planning',
  },

  // GENERAL ADVICE
  {
    content: 'Diversification is key for Indian portfolios: 50-60% equity (mutual funds/stocks), 20-30% debt (PPF/EPF/debt funds), 10-15% gold (SGBs), 5-10% real estate/alternatives. Rebalance annually. Young investors can have higher equity allocation up to 80%.',
    category: 'general',
    source: 'Asset Allocation Guidelines',
  },
  {
    content: 'Financial planning priority order: 1) Build ₹50,000 emergency fund, 2) Get term insurance and health insurance, 3) Pay off high-interest debt, 4) Start retirement savings (EPF/PPF/NPS), 5) Invest for goals, 6) Increase emergency fund to 6 months expenses.',
    category: 'general',
    source: 'Personal Finance Roadmap',
  },
];


