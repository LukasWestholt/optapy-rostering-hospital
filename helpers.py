#!/usr/bin/env python3
# coding: utf-8
from random import Random


def pick_random(source: list, random: Random):
    return random.choice(source)


def pick_subset(source: list, random: Random, *distribution: int):
    if not source:
        return []
    item_count = random.choices(range(len(distribution)), distribution)
    return random.sample(source, item_count[0])

def join_all_combinations(*part_arrays: list[str]):
    if len(part_arrays) == 0:
        return []
    if len(part_arrays) == 1:
        return part_arrays[0]
    combinations = []
    for combination in join_all_combinations(*part_arrays[1:]):
        for item in part_arrays[0]:
            combinations.append(f'{item} {combination}')
    return combinations