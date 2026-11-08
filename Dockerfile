# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy requirements file first to leverage Docker caching
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code into the container
COPY . .

# Expose the port your FastAPI app runs on
EXPOSE 8000

# Command to run your app matching your main.py file
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]