## Simple Maxium Borrow

From Aave protocol, every debt position needs to maintain its [health factor](https://docs.aave.com/risk/asset-risk/risk-parameters#health-factor) greater than 1, which means:

<img src="https://render.githubusercontent.com/render/math?math=HF=\frac{Asset_{collat}}{Debt}=\frac{\sum_{i=1}^{k}(R_{liq}^{i}\cdot A_{i})}{Debt}\geq 1" title="Health factor" />

<br>
<br>

<img src="https://latex.codecogs.com/svg.latex?A_{i} , R_{liq}^{i}" title="Loan constraints" /> are the *i*th asset value in ether and its [liquidation threshold](https://docs.aave.com/risk/asset-risk/risk-parameters#liquidation-threshold) respectively.

Therefore, if we'd like to borrow _L_ in value with some existing debt _D_, the following must be satisfied:

<img src="https://latex.codecogs.com/svg.png?\ \sum_{i=1}^{k}(R_{liq}^{i}\cdot A_{i})-D_{exist}-L\geq 0\textbf{ (1)}" title="Simple maximum borrow" />

<br>Or,

<img src="https://latex.codecogs.com/svg.latex?L\leq \sum_{i=1}^{k}(R_{liq}^{i}\cdot A_{i})-D_{exist}\textbf{ (2)}" title="Simple maximum borrow constraint" />

<br> In practice, Aave has another constraint called [_Maximum Loan To Value_](https://docs.aave.com/risk/asset-risk/risk-parameters#loan-to-value) (LTV) on its assets, which is less than the liquidation threshold of that particular asset. This sets some safety buffer to protect the position from being liquidated in case the user borrows so much to drive his HF to 1. So the maximum he can borrow is:

<img src="https://latex.codecogs.com/svg.latex?L_{max}= \sum_{i=1}^{k}(R_{ltv}^{i}\cdot A_{i})-D_{exist}\textbf{ (3)}" title="Simple maximum borrow constraint" />

<br>
<br>

<img src="https://latex.codecogs.com/svg.latex?R_{ltv}^{i}" title="Loan to value" /> is the maximum _loan to value_ of the *i*th asset.

## Leverage

#### Borrow and Deposit Back

Sometimes people borrowing an asset just want to engineer some leveraged positions. For instance, they can short an asset by borrowing it, swapping it for a stable coin, then depositing the latter back. (A long position can be created just by swapping the asset pair just mentioned.) Suppose we borrow an asset with value _L_, exchange it to token _t_ with value _L'_ and deposit back. From **(1)**, we must satisfy:

<img src="https://latex.codecogs.com/svg.latex?\ \sum_{i=1}^{k}(R_{liq}^{i}\cdot A_{i}) + R_{liq}^{t}\cdot L' -D_{exist}-L\geq 0" title="Maximum borrow by depositing back" />

<br> Or, in practice:

<img src="https://latex.codecogs.com/svg.latex?\ \sum_{i=1}^{k}(R_{ltv}^{i}\cdot A_{i}) + R_{ltv}^{t}\cdot L' -D_{exist}-L\geq 0\textbf{ (4)}" title="Maximum borrow by depositing back" />

<br> If we don't consider the slippage during token swaps, which means _L_ = _L'_, the maximum you can end up borrowing is:

<img src="https://latex.codecogs.com/svg.latex?L_{max}=\frac{R_{ltv}^{A}\cdot A-D_{exist}}{1-R_{ltv}^{t}}\textbf{ (5)}" title="Maximum borrow by depositing back" />

<br> Compared to **(3)**, suppose
<img src="https://latex.codecogs.com/svg.latex?R_{ltv}^{t}" title="Loan to value" /> is 80%, with the same amount of collaterals, in theory we can get 5 times of the original borrowing power, which is why we call it a leveraged position.

However, without increasing our collateral this can only be done by multiple borrow & deposit operations since each time the borrow limit is still enforced by **(3)**, not **(5)**.

#### Deposit, then Borrow

To achieve the aforementioned in a single operation, we need to reverse our process by acquiring some extra liquidity upfront. If someone can lend you _L_ amount of stable coins to increase your collateral, then you will be able to borrow the same amount of some token from the liquidity pool. You repay that person by swapping your token to the stable coins.

##### Flash Loan

Without asking a friend to do us this favor, we can utilize Aave's [flash loans](https://docs.aave.com/developers/guides/flash-loans) in this situation. It's not free. Consider **(4)**, the fee incurred for _L'_ amount is:

<img src="https://latex.codecogs.com/svg.latex?fee=R_{flash}\cdot&space;L'" title="Flash loan fee" />

<br>
<br>

<img src="https://latex.codecogs.com/svg.latex?R_{flash}" title="Flash loan rate" /> is the rate of flash loan (0.09% currently in Aave).

Plus, we need to factor the lost due to the swap slippage in as well.

1. Pay fees using the collateral

  <img src="https://latex.codecogs.com/svg.latex?L\cdot(1-R_{slip})=(L' + fee)" title="lost in swap slippage" />
  <br>
  <br> Or,
  <img src="https://latex.codecogs.com/svg.latex?L' = L \cdot \frac{1-R_{slip}}{1+R_{flash}} " title="lost in swap slippage" />

2. Pay fees with extra ethers

  <img src="https://latex.codecogs.com/svg.latex?L' = L\cdot(1-R_{slip})" title="lost in swap slippage" />

In both cases, **(4)** has to be satisfied, or:

<img src="https://latex.codecogs.com/svg.latex?L \leq \sum_{i=1}^{k}(R_{ltv}^{i}\cdot&space;A_{i})-D_{exist} + R_{ltv}^{t}\cdot L' \textbf{ (6)}" title="maximum borrow with depositing back" />

<br> Our health factor after those operations will be:

<img src="https://latex.codecogs.com/svg.latex?HF=\frac{Asset_{collat}}{Debt}=\frac{Asset_{exist}+Asset_{\Delta} }{L+ D_{exist}}=\frac{\sum_{i=1}^{k} (R_{liq}^{i}\cdot A_{i})+R_{liq}^{L}\cdot L'}{L+D_{exist}}\textbf{ (7)}" title="Health factor" />

## Deleverage

A user can specify the amount of the debt asset she's willing to repay and a list of collaterals to swap out for that asset. The total collateral to be reduced is:

<img src="https://latex.codecogs.com/svg.latex?A'=\sum_{i=1}^{m}A'_{i}\textbf{ (8)}" />

<br>
<br>

<img src="https://latex.codecogs.com/svg.latex?A'_{i}" title="Asset to reduce" /> is the reduced value\_ for the *i*th collateral.

Since Aave protocol doesn't allow a smart contract to withdraw collateral on behalf of a user. We still need to resort to flash loan to pay down the debt. First we flash-loan the same amount of debt token to repay the debt our user wants to reduce, which incurs fee:

<img src="https://latex.codecogs.com/svg.latex?fee=R_{flash}\cdot D_{repay}" title="Flash loan fee" />

<br> Secondly, we swap the reduced collaterals to the debt token to repay the flash loan. Consider the slippage, the amount we got after the swap will be:

<img src="https://latex.codecogs.com/svg.latex?\Delta=(1-R_{slip})\cdot&space;A'\textbf{ (9)}" title="Collateral reduced after swap" />

<br> And make sure we verify in either case:

1. Pay fees using the collateral

  <img src="https://latex.codecogs.com/svg.latex?\Delta\geq D_{repay} + fee" title="Fee constraint" />

2. Pay fees with extra ethers

  <img src="https://latex.codecogs.com/svg.latex?\Delta\geq D_{repay}" title="Fee constraint" />

Our new debt position:

<img src="https://latex.codecogs.com/svg.latex?Debt=D_{exist}-D_{repay}\textbf{ (15)}" title="New debt position" />

<br>New health factor:

<img src="https://latex.codecogs.com/svg.latex?HF=\frac{Asset_{collat}}{Debt}=\frac{\sum_{i=1}^{k}R_{liq}^{i}\cdot A_{i} -\sum_{i=1}^{m}R_{liq}^{i}\cdot A'_{i}}{D_{exist}-D_{repay}}\textbf{ (17)}" title="Health factor" />
