## Leverage

#### Single token maximum borrow

From Aave protocol, every debt position needs to maintain its **Health Factor** greater than 1:

<img src="https://latex.codecogs.com/svg.latex?HF=\frac{Asset_{collat}}{Debt}=\frac{R_{liq}^{A}\cdot&space;A}{D_{exist}}\geq 1\textbf{ (1)}" title="Health factor" />

<br> Therefore, if we'd like to borrow _L_ amount, the following must be satisfied:

<img src="https://latex.codecogs.com/svg.latex?\ R_{liq}^{A}\cdot&space;A-L-D_{exist}\geq 0" title="Single token maximum borrow" />

<br>Or,

<img src="https://latex.codecogs.com/svg.latex?L\leq R_{liq}^{A}\cdot&space;A-D_{exist}\textbf{ (2)}" title="Single token maximum borrow" />

<br> max case

<img src="https://latex.codecogs.com/svg.latex?L_{max}=R_{liq}^{A}\cdot A-D_{exist}\textbf{ (3)}" title="L_{max}=R_{liq}\cdot A" />

##### Borrow with depositing back

<img src="https://latex.codecogs.com/svg.latex?R_{liq}^{A}\cdot A+R_{liq}^{L}\cdot L'-L-D_{exist}\geq&space;0" title="borrow with deposit" />

<br>If someone can lend you _L_ upfront to increase your collateral, then you borrow the same amount from the liquidity pool to pay him back, which means _L'_ = _L_, the max you can end up borrowing is:

<img src="https://latex.codecogs.com/svg.latex?L_{max}=\frac{R_{liq}^{A}\cdot A-D_{exist}}{1-R_{liq}^{L}}\textbf{ (4)}" title="L_{max}=R_{liq}\cdot A" />

<br>Based on Aave's borrow constraints, in order to borrow the amount equal to **(4)**, the collateral in **(3)** must be

<img src="https://latex.codecogs.com/svg.latex?R_{liq}^{A}\cdot A'-D_{exist}=\frac{R_{collat}^{A}\cdot A-D_{exist}}{1-R_{liq}^{L}}" title="L_{max}=R_{liq}\cdot A" />

<br>Let

<img src="https://latex.codecogs.com/svg.latex?S'=R_{liq}^{A}\cdot A' , S=R_{collat}^{A}\cdot A" />

<br> we can have

<img src="https://latex.codecogs.com/svg.latex?S'=\frac{S-R_{liq}^{L}\cdot D_{exist}}{1-R_{liq}^{L}}" />

<br>which means we have to increase our collateral by:

<img src="https://latex.codecogs.com/svg.latex?\Delta=S'-S=(S-D_{exist})\cdot \frac{R_{liq}^{L}}{1-R_{liq}^{L}}\textbf{ (5)}" />

<br> consider in **(4)**:
<img src="https://latex.codecogs.com/svg.latex?L=\frac{S-D_{exist}}{1-R_{liq}^{L}}" title="L_{max}=R_{liq}\cdot A" />
<br> So

<img src="https://latex.codecogs.com/svg.latex?\Delta=L\cdot R_{liq}^{L}\textbf{ (6)}" />

#### Multiple token maximum borrow

<br> similar to **(2)**, if borrowing without depositing back, the amount we can get is:

<img src="https://latex.codecogs.com/svg.latex?L= \sum_{i=1}^{k}(R_{collat}^{i}\cdot&space;A_{i})-D_{exist},\left\{0\leq&space;R_{collat}^{i}\leq&space;R_{liq}^{i}\right\}\textbf{ (7)}" title="Multi token maximum borrow" />

<br> If we turn the borrowed token into another token (those two tokens could be the same in theory) and deposit it back, the amount we can borrow is:

<img src="https://latex.codecogs.com/svg.latex?L= \frac{\sum_{i=1}^{k}(R_{collat}^{i}\cdot&space;A_{i})-D_{exist}}{1-R_{collat}^{L}} ,\left\{0\leq&space;R_{collat}^{i,L}\leq&space;R_{liq}^{i,L}\right\}" title="Multi token borrow" />

<br>A max case:

<img src="https://latex.codecogs.com/svg.latex?L_{max}= \frac{\sum_{i=1}^{k}(R_{liq}^{i}\cdot&space;A_{i})-D_{exist}}{1-R_{liq}^{L}}\textbf{ (8)}" title="Multi token maximum borrow" />

<br> Note that the form of **(8)** is similar to **(3)**, so our new delta can be the same as **(6)**:

<img src="https://latex.codecogs.com/svg.latex?\Delta=L\cdot R_{liq}^{L}" />

##### consider flash loan fees and swap slippage

the amount we need to repay flash loan is:

<img src="https://latex.codecogs.com/svg.latex?fee=L_{flash}\cdot&space;L'" title="L_{max}=R_{liq}\cdot A" />

<br> however, we need to consider the slippage after the swap as well:

<img src="https://latex.codecogs.com/svg.latex?L\cdot(1-L_{slip})=(L' + fee)" title="lost in swap slippage" />

<br> Or,
<img src="https://latex.codecogs.com/svg.latex?L' = \frac{1-L_{slip}}{1+L_{flash}}\cdot L " title="lost in swap slippage" />

<br>If this amount will be paid from our existing assets, in the beginning we need to check:

<img src="https://latex.codecogs.com/svg.latex? \sum_{i=1}^{k}(R_{liq}^{i}\cdot&space;A_{i}) + R_{liq}\cdot L'- L -D_{exist}\geq 0 \textbf{ (7)}" title="Multi token maximum borrow" />

<br> Or:

<img src="https://latex.codecogs.com/svg.latex?L \leq \sum_{i=1}^{k}(R_{liq}^{i}\cdot&space;A_{i})-D_{exist} + R_{liq}\cdot L' \textbf{ (7)}" title="Multi token maximum borrow" />

<br> If fees are considered separately, then

<img src="https://latex.codecogs.com/svg.latex?L' = L\cdot(1-L_{slip})" title="lost in swap slippage" />

<br> Our health factor after those operations will be:

<img src="https://latex.codecogs.com/svg.latex?HF=\frac{Asset_{collat}}{Debt}=\frac{Asset_{exist}+Asset_{\Delta} }{L+ D_{exist}}=\frac{\sum_{i=1}^{k} (R_{liq}^{i}\cdot A_{i})+R_{liq}^{L}\cdot L'}{L+D_{exist}}\textbf{ (12)}" title="Health factor" />

## Deleverage

User specifies the list of collaterals she's willing to swap out. The total amount will be:

<img src="https://latex.codecogs.com/svg.latex?A'=\sum_{i=1}^{k}A'_{i}\textbf{ (13)}" />

<br> And the amount of debt token she's willing to repay:

<img src="https://latex.codecogs.com/svg.latex?D_{repay}" title="fee constraints" />

Since Aave protocol doesn't allow contract to withdraw user's collateral to pay down the debt. We still need to resort to flash loan. We first flash-loan _D_ to reduce user's debt, which incurs fee:

<img src="https://latex.codecogs.com/svg.latex?fee=L_{flash}\cdot D_{repay}" title="fee constraints" />

<br> The amount of collateral after being converted to targetToken to repay flash loan will be:

<img src="https://latex.codecogs.com/svg.latex?\Delta=(1-L_{slip})\cdot&space;A'\textbf{ (14)}" title="total fee" />

<br> And make sure

<img src="https://latex.codecogs.com/svg.latex?\Delta\geq D_{repay} + fee " title="total fee" />

<br> Or the total fee

<img src="https://latex.codecogs.com/svg.latex?fee' = A' \cdot L_{slip} + D_{repay}\cdot L_{flash}\leq A' - D_{repay} " title="total fee" />

<br> Our new debt position:

<img src="https://latex.codecogs.com/svg.latex?Debt=D_{exist}-D_{repay}\textbf{ (15)}" title="total fee" />

<br> New assets that can be used as collateral

<img src="https://latex.codecogs.com/svg.latex?Asset_{collat}=\sum_{i=1}^{k}R_{liq}^{i}\cdot A_{i} -\sum_{i=1}^{m}R_{liq}^{i}\cdot A'_{i}\textbf{ (16)}" />

<br>New health factor:

<img src="https://latex.codecogs.com/svg.latex?HF=\frac{Asset_{total}}{Debt}=\frac{\sum_{i=1}^{k}R_{liq}^{i}\cdot A_{i} -\sum_{i=1}^{m}R_{liq}^{i}\cdot A'_{i}}{D_{exist}-D_{repay}}\textbf{ (17)}" title="Health factor" />
