import pydtmc

NUMBER_OF_NODES = 1024
R = 4

penMultiplierDisagreement = 1
nHoods = NUMBER_OF_NODES // R
#given equal stakes
#roundLength = ???
# 1/|neighbourhood| * 1/|n part of neighbourhood| 

expectedRewardPercentageHonest = (1/nHoods) * (1/R)

#one malicious user model

p_M = (1/nHoods) * (1/R)
p_H = (1/nHoods) * ((R-1)/R)


#adjacency matrix 3x3
naiveP = [[1-(p_M+p_H), p_M, p_H], 
     [1/R,((R-1)/R), 0.0], 
     [1/R, 0.0, ((R-1)/R)]]

mc = pydtmc.MarkovChain(naiveP, ['unfrozen', 'mFrozen', 'hFrozen'])
print(mc)



print(mc.expected_rewards(10000,[0,1,1/3]))
print(mc.mean_recurrence_times())
res =  mc.simulate(10000,initial_state="unfrozen", seed=32)

pydtmc.plot_graph(mc, dpi=600,force_standard=True)