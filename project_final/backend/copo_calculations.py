def calculate_po_attainment(matrix):
    """
    matrix = [
      [3,2,0,0],
      [2,3,3,1],
      [3,3,2,1],
      [2,3,2,2]
    ]
    """
    total_cos = len(matrix)
    total_pos = len(matrix[0])

    po_attainment = []

    for po in range(total_pos):
        po_sum = 0
        for co in range(total_cos):
            po_sum += matrix[co][po]
        po_attainment.append(round(po_sum / total_cos, 2))

    return po_attainment
