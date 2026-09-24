"""World today: Natural Earth countries (nations chosen by build/world.py svijet, names from build/names_bs.py).
Dependencies, disputed areas and countries too small for the grid are free land; Crimea and Kashmir (disputed-areas
layer) too. Taiwan is a normal country."""
SRC = 'ne'
TINY = 'neutral'


def DISPUTED(pr, b):  # b = lon/lat bbox of a disputed area
    return pr['NAME'] == 'Crimea' or (b[0] >= 72 and b[2] <= 81 and b[1] >= 32 and b[3] <= 37.5)
