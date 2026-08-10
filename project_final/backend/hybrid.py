def hybrid_score(tfidf, use, bert):
    return (0.2 * tfidf) + (0.3 * use) + (0.5 * bert)

def mapping_level(score):
    if score < 0.4: return 0
    if score < 0.6: return 1
    if score < 0.75: return 2
    return 3
