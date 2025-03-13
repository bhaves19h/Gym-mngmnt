// File: src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMembers from './pages/admin/Members';
import AdminPayments from './pages/admin/Payments';
import AdminReports from './pages/admin/Reports';
import UserDashboard from './pages/user/Dashboard';
import UserPayments from './pages/user/Payments';
import UserProfile from './pages/user/Profile';
import Navbar from './components/Navbar';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children, requireAdmin }) => {
  const { currentUser, userData } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (requireAdmin && userData?.role !== 'admin') {
    return <Navigate to="/user/dashboard" />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/members" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminMembers />
                </ProtectedRoute>
              } />
              <Route path="/admin/payments" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPayments />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminReports />
                </ProtectedRoute>
              } />
              
              {/* User Routes */}
              <Route path="/user/dashboard" element={
                <ProtectedRoute requireAdmin={false}>
                  <UserDashboard />
                </ProtectedRoute>
              } />
              <Route path="/user/payments" element={
                <ProtectedRoute requireAdmin={false}>
                  <UserPayments />
                </ProtectedRoute>
              } />
              <Route path="/user/profile" element={
                <ProtectedRoute requireAdmin={false}>
                  <UserProfile />
                </ProtectedRoute>
              } />
              
              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

// File: src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register(email, password, name) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    register,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// File: src/pages/admin/Members.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import './Members.css';

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    membershipType: 'monthly',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'member'));
      const querySnapshot = await getDocs(q);
      
      const membersList = [];
      querySnapshot.forEach((doc) => {
        membersList.push({ id: doc.id, ...doc.data() });
      });
      
      setMembers(membersList);
    } catch (error) {
      console.error("Error fetching members: ", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    
    try {
      // Generate a unique ID
      const memberId = doc(collection(db, 'users')).id;
      
      // Set member data
      await setDoc(doc(db, 'users', memberId), {
        ...newMember,
        role: 'member',
        createdAt: new Date().toISOString()
      });
      
      // Reset form and close modal
      setNewMember({
        name: '',
        email: '',
        phone: '',
        membershipType: 'monthly',
        startDate: '',
        endDate: ''
      });
      setShowAddModal(false);
      
      // Refresh members list
      fetchMembers();
    } catch (error) {
      console.error("Error adding member: ", error);
    }
  }

  async function handleDeleteMember(id) {
    if (window.confirm("Are you sure you want to delete this member?")) {
      try {
        await deleteDoc(doc(db, 'users', id));
        fetchMembers();
      } catch (error) {
        console.error("Error deleting member: ", error);
      }
    }
  }

  return (
    <div className="members-page">
      <div className="members-header">
        <h1>Gym Members</h1>
        <button onClick={() => setShowAddModal(true)} className="add-button">Add New Member</button>
      </div>
      
      {loading ? (
        <p>Loading members...</p>
      ) : (
        <div className="members-table-container">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Membership</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.phone}</td>
                  <td>{member.membershipType}</td>
                  <td>{new Date(member.startDate).toLocaleDateString()}</td>
                  <td>{new Date(member.endDate).toLocaleDateString()}</td>
                  <td>
                    <button className="edit-button">Edit</button>
                    <button onClick={() => handleDeleteMember(member.id)} className="delete-button">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {showAddModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowAddModal(false)}>&times;</span>
            <h2>Add New Member</h2>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  required 
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  required 
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input 
                  type="tel" 
                  required 
                  value={newMember.phone}
                  onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Membership Type</label>
                <select 
                  value={newMember.membershipType}
                  onChange={(e) => setNewMember({...newMember, membershipType: e.target.value})}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input 
                  type="date" 
                  required 
                  value={newMember.startDate}
                  onChange={(e) => setNewMember({...newMember, startDate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input 
                  type="date" 
                  required 
                  value={newMember.endDate}
                  onChange={(e) => setNewMember({...newMember, endDate: e.target.value})}
                />
              </div>
              <button type="submit" className="submit-button">Add Member</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;

// File: src/pages/user/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './Dashboard.css';

function UserDashboard() {
  const { currentUser } = useAuth();
  const [membershipData, setMembershipData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMembershipData() {
      if (!currentUser) return;
      
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setMembershipData(userDoc.data());
        }
      } catch (error) {
        console.error("Error fetching membership data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchMembershipData();
  }, [currentUser]);

  function getDaysRemaining() {
    if (!membershipData?.endDate) return 0;
    
    const endDate = new Date(membershipData.endDate);
    const today = new Date();
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="user-dashboard">
      <h1>Welcome, {membershipData?.name || 'Member'}</h1>
      
      <div className="dashboard-cards">
        <div className="card membership-card">
          <h2>Membership Status</h2>
          <div className="card-content">
            <p>Type: <strong>{membershipData?.membershipType || 'N/A'}</strong></p>
            <p>Start Date: <strong>{membershipData?.startDate ? new Date(membershipData.startDate).toLocaleDateString() : 'N/A'}</strong></p>
            <p>End Date: <strong>{membershipData?.endDate ? new Date(membershipData.endDate).toLocaleDateString() : 'N/A'}</strong></p>
            <p>Days Remaining: <strong>{getDaysRemaining()}</strong></p>
          </div>
        </div>
        
        <div className="card quick-actions-card">
          <h2>Quick Actions</h2>
          <div className="card-content">
            <button className="action-button">Renew Membership</button>
            <button className="action-button">View Payment History</button>
            <button className="action-button">Update Profile</button>
          </div>
        </div>
      </div>
      
      <div className="upcoming-payments">
        <h2>Upcoming Payment</h2>
        {getDaysRemaining() <= 30 ? (
          <div className="payment-alert">
            <p>Your membership expires in {getDaysRemaining()} days.</p>
            <button className="pay-now-button">Pay Now</button>
          </div>
        ) : (
          <p>No upcoming payments due soon.</p>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
