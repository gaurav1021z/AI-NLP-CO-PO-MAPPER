from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def tfidf_similarity(cos, pos):
    vectorizer = TfidfVectorizer(stop_words='english')
    vectors = vectorizer.fit_transform(cos + pos)
    return cosine_similarity(vectors[:len(cos)], vectors[len(cos):])
