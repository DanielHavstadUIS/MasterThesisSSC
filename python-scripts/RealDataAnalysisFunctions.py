import pandas as pd
import numpy as np
import sqlite3
import matplotlib.pyplot as plt
from web3 import Web3

db_path = "../data/swarmscan.db"



# Function to read data from a table and return a DataFrame
def read_table(table_name):
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Execute SQL query to fetch data from the table
    cursor.execute(f"SELECT * FROM {table_name}")

    # Fetch all rows from the cursor
    rows = cursor.fetchall()

    # Convert fetched data into a DataFrame
    df = pd.DataFrame(rows, columns=[col[0] for col in cursor.description])

    # Close the cursor and the connection
    cursor.close()
    conn.close()

    return df

rounds_df = read_table("rounds")
reveals_df = read_table("reveals")
originalWinners_df = read_table("originalWinners")
originalFrozens_df = read_table("originalFrozens")

w3 = Web3()
bank_overlay = bank_overlay = w3.keccak(text="BANK")
bank_overlay = bank_overlay.hex()


def get_original_contract_test_data():
    CSVDATA = pd.read_csv("../data/fixed/banksolResultsfixed.csv")
    winners = []
    majorityReveals = []
    for index, row in CSVDATA.iterrows():
       
        rndnr = row["Round Number"]
        winner_data = originalWinners_df[originalWinners_df['roundNumber'] == rndnr]
        #print(winner_data)
        winners.append(winner_data)
        reveals_data = reveals_df[reveals_df['roundNumber'] == rndnr]
        
        reserve_commitments_count = {}
        for reveal_index, reveal_row in reveals_data.iterrows():
            reserve_commitment = reveal_row['reserveCommitment']
            reserve_commitments_count[reserve_commitment] = reserve_commitments_count.get(reserve_commitment, 0) + 1
        
        # Find the most common reserveCommitment (majority reveal)
        most_common_commitment = max(reserve_commitments_count, key=reserve_commitments_count.get)
        majorityReveals.append(most_common_commitment)
    return winners, majorityReveals

def get_original_contract_test_data_stake_based(csv_path):
    CSVDATA = pd.read_csv(csv_path)
    winners = []
    majorityReveals = []
    reserve_commit_to_stake_maps = []
    for index, row in CSVDATA.iterrows():
       
        rndnr = row["Round Number"]
        winner_data = originalWinners_df[originalWinners_df['roundNumber'] == rndnr]
        #print(winner_data)
        reveals_data = reveals_df[reveals_df['roundNumber'] == rndnr]
        reserve_commitments_stake = {}
        for reveal_index, reveal_row in reveals_data.iterrows():
            reserve_commitment = reveal_row['reserveCommitment']
            stake = reveal_row['stakeDensity']
            reserve_commitments_stake[reserve_commitment] = reserve_commitments_stake.get(reserve_commitment, 0) + stake
        
        # Find the most common reserveCommitment (majority reveal)
        # if len(reserve_commitments_stake) < 2:
        #     continue

        most_common_commitment = max(reserve_commitments_stake, key=reserve_commitments_stake.get)
        winners.append(winner_data)
        majorityReveals.append(most_common_commitment)
        reserve_commit_to_stake_maps.append(reserve_commitments_stake)
    return winners, majorityReveals, reserve_commit_to_stake_maps

def process_original_contract_test_data(csv_path):
    # Get winners and majority reveals
    winners, majority_reveals, reserve_commitments_stake = get_original_contract_test_data_stake_based(csv_path)
    
    # Initialize variables
    number_minority_wins = 0
    amount_minority_reward = 0
    number_majority_wins = 0
    amount_majority_reward = 0
    amount_bank_wins = 0
    total_rounds = len(winners)  # Assuming winners and majority_reveals have the same length

    # Iterate over each round
    index = 0
    for winner, majority_reveal in zip(winners, majority_reveals):
        # if index > 10 and index < 30:
        #     print(index)
        #     print(reserve_commitments_stake[index])
        #     print(len(reserve_commitments_stake[index]))
        #     print(len(reserve_commitments_stake[index])<2)
       
        if len(reserve_commitments_stake[index]) < 2:
             index += 1
             continue
        #print(winner["hash"].item())
        reserveCommitment = winner["hash"].item()
        reward = winner["rewardAmount"].item()
        #print(majority_reveal)
        if reserveCommitment == majority_reveal:
            number_majority_wins += 1
            # Add reward to majority reward
            amount_majority_reward += reward 
        if reserveCommitment == bank_overlay:
            amount_bank_wins += 1
        elif reserveCommitment != majority_reveal:
            number_minority_wins += 1
            # Add reward to minority reward
            amount_minority_reward += reward 
        index += 1
    # Calculate percentages
    percent_minority_wins = (number_minority_wins / total_rounds) * 100
    percent_majority_wins = (number_majority_wins / total_rounds) * 100
    percent_bank_wins = (amount_bank_wins / total_rounds) * 100

    
    # Print results
    print(f"Number of rounds where minority wins: {number_minority_wins}")
    print(f"Amount rewarded to minority: {amount_minority_reward}")
    print(f"Number of rounds where majority wins: {number_majority_wins}")
    print(f"Amount rewarded to majority: {amount_majority_reward}")
    print(f"Number of rounds where bank wins: {amount_bank_wins}")
    print(f"Percentage of rounds where minority wins: {percent_minority_wins}%")
    print(f"Percentage of rounds where majority wins: {percent_majority_wins}%")
    print(f"Percentage of rounds won by the bank: {percent_bank_wins}%")


# Read CSV data into a DataFrame
def process_data(csv_path):
        CSVDATA = pd.read_csv(csv_path)
        original_winners, majority_reveals, reserve_commitments_stake = get_original_contract_test_data_stake_based(csv_path)

        # Initialize variables
        number_minority_wins = 0
        amount_minority_reward = 0
        number_majority_wins = 0
        amount_majority_reward = 0
        amount_bank_wins = 0
        amount_bank_rollover = 0

        # Iterate over each row in the DataFrame
        index = 0
        for index, row in CSVDATA.iterrows():
               
            if len(reserve_commitments_stake[index]) < 2:
                 index += 1
                 continue
            index += 1
            reward = int(row['Reward'])  # Convert reward to integer
            if row['Hash'] == row['MajorityReveal']:
                number_majority_wins += 1
                amount_majority_reward += reward
            if row['Winner'] == bank_overlay:
                amount_bank_wins += 1
                amount_bank_rollover += reward
            elif row['Hash'] != row['MajorityReveal']:
                number_minority_wins += 1
                amount_minority_reward += reward

        # Calculate percentages
        total_rounds = len(CSVDATA)
        percent_minority_wins = (number_minority_wins / total_rounds) * 100
        percent_majority_wins = (number_majority_wins / total_rounds) * 100
        percent_bank_wins = (amount_bank_wins / total_rounds) * 100

        # Print results
        print(f"Number of rounds where minority wins: {number_minority_wins}")
        print(f"Amount rewarded to minority: {amount_minority_reward}")
        print(f"Number of rounds where majority wins: {number_majority_wins}")
        print(f"Amount rewarded to majority: {amount_majority_reward}")
        print(f"Number of rounds where bank wins: {amount_bank_wins}")
        print(f"Amount rewarded to bank: {amount_bank_rollover}")
        print(f"Percentage of rounds where minority wins: {percent_minority_wins}%")
        print(f"Percentage of rounds where majority wins: {percent_majority_wins}%")
        print(f"Percentage of rounds won by the bank: {percent_bank_wins}%")


def plot_rewards_over_rounds(csv_path):
    # Read the CSV file
    CSVDATA = pd.read_csv(csv_path)

    # Initialize variables
    rewards_minority = []
    rewards_majority = []
    rewards_bank = []
    rounds_processed = []

    # Iterate over each row in the DataFrame
    for index, row in CSVDATA.iterrows():
       
        #print(index)
        reward = int(row['Reward'])  # Convert reward to integer

        if row['Winner'] == bank_overlay:
            print(rewards_bank)
            if len(rewards_bank) > 0:
                cumulative_reward = rewards_bank[index-1] + reward
                rewards_minority.append(rewards_minority[index-1])
                rewards_majority.append(rewards_majority[index-1])
                rewards_bank.append(cumulative_reward)
            else:
                rewards_minority.append(0)
                rewards_majority.append(0)
                rewards_bank.append(reward)
        
        elif row['Hash'] != row['MajorityReveal']:
          #  print(f"minrewlen {len(rewards_minority)}")
            if len(rewards_minority)> 0:
                cumulative_reward = rewards_minority[index-1] + reward
                rewards_minority.append(cumulative_reward)
                rewards_majority.append(rewards_majority[index-1])
                rewards_bank.append(rewards_bank[index-1])
            else:
                rewards_minority.append(reward)
                rewards_majority.append(0)
                rewards_bank.append(0)
            
        
        elif row['Hash'] == row['MajorityReveal']:
         #  print(f"majrewlen {len(rewards_majority)}")

           if len(rewards_majority)> 0:
                cumulative_reward = rewards_majority[index-1] + reward
                rewards_minority.append(rewards_minority[index-1])
                rewards_majority.append(cumulative_reward)
                rewards_bank.append(rewards_bank[index-1])
           else:
                rewards_minority.append(0)
                rewards_majority.append(reward)
                rewards_bank.append(0)
               
        rounds_processed.append(index + 1)  # Index starts from 0, so add 1 for the round number

    # Plot the rewards over the number of rounds processed
    plt.figure(figsize=(10, 6))
    plt.plot(rounds_processed, rewards_minority, label='Minority Reward', color='blue')
    plt.plot(rounds_processed, rewards_majority, label='Majority Reward', color='green')
    plt.plot(rounds_processed, rewards_bank, label='Bank reward carryover', color='red')

    plt.xlabel('Rounds Processed')
    plt.ylabel('Reward')
    plt.title('Rewards Over Rounds Processed')
    plt.legend()
    plt.grid(True)
    plt.show()