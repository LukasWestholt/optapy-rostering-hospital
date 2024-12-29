#!/usr/bin/env python3
# coding: utf-8

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